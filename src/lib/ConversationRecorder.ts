import { EventEmitter } from "eventemitter3"
import { MicAudioRecorder } from "lib/MicAudioRecorder"
import { TabAudioRecorder } from "lib/TabAudioRecorder"
import { throwErr } from "lib/util"

export class ConversationRecorder {
  micRecorder:MicAudioRecorder
  tabRecorder:TabAudioRecorder
  private audioContext:AudioContext | null = null
  private destination:MediaStreamAudioDestinationNode | null = null
  capturing = false
  outputStream:MediaStream | null = null
  mediaRecorder:MediaRecorder | null = null
  audioChunks:Blob[] = []
  gainNodeMic:GainNode|null = null
  gainNodeTab:GainNode|null = null
  analyserNodeMic:AnalyserNode|null = null
  analyserNodeTab:AnalyserNode | null = null
  balanceLoopIntervalId:NodeJS.Timeout | null = null
  events:EventEmitter = new EventEmitter()

  constructor(micRecorder?:MicAudioRecorder, tabRecorder?:TabAudioRecorder) {
    this.micRecorder = micRecorder || new MicAudioRecorder()
    this.tabRecorder = tabRecorder || new TabAudioRecorder()
  }



  startBalancingLoop() {
    const INTERVAL_MS = 100 // Frequency of balance checks in milliseconds
    if (!this.audioContext) throwErr("Audio context not initialized")
    if (!this.gainNodeMic) throwErr("Gain node not initialized")
    if (!this.gainNodeTab) throwErr("Gain node not initialized")

    this.analyserNodeMic = new AnalyserNode(this.audioContext)
    this.analyserNodeTab = new AnalyserNode(this.audioContext)

    // Connect the gain nodes to the analyser nodes
    this.gainNodeMic.connect(this.analyserNodeMic)
    this.gainNodeTab.connect(this.analyserNodeTab)

    // FFT size for frequency data (should be power of 2)
    const FFT_SIZE = 256
    this.analyserNodeMic.fftSize = FFT_SIZE
    this.analyserNodeTab.fftSize = FFT_SIZE

    const bufferLengthMic = this.analyserNodeMic.frequencyBinCount
    const bufferLengthTab = this.analyserNodeTab.frequencyBinCount
    const dataArrayMic = new Uint8Array(bufferLengthMic)
    const dataArrayTab = new Uint8Array(bufferLengthTab)

    this.balanceLoopIntervalId = setInterval(() => {
      if (!this.analyserNodeMic || !this.analyserNodeTab) {
        console.error("Analyser node not initialized")
        return
      }

      this.analyserNodeMic.getByteFrequencyData(dataArrayMic)
      this.analyserNodeTab.getByteFrequencyData(dataArrayTab)

      const avgLevelMic = dataArrayMic.reduce((acc, val) => acc + val, 0) / bufferLengthMic
      const avgLevelTab = dataArrayTab.reduce((acc, val) => acc + val, 0) / bufferLengthTab

      // Simple normalization strategy (you might need to adjust this logic)
      const totalAvg = (avgLevelMic + avgLevelTab) / 2
      const newGainMic = totalAvg / Math.max(avgLevelMic, 1)
      const newGainTab = totalAvg / Math.max(avgLevelTab, 1)

      // Clamp the gain values to a reasonable range
      if (!this.gainNodeMic || !this.gainNodeTab) throwErr("Gain node not initialized")
      this.gainNodeMic.gain.value = Math.max(0.1, Math.min(newGainMic, 2)) // Example range [0.1, 2]
      this.gainNodeTab.gain.value = Math.max(0.1, Math.min(newGainTab, 2)) // Example range [0.1, 2]
    }, INTERVAL_MS)
  }

  stopBalancingLoop() {
    if (this.balanceLoopIntervalId !== null) {
      clearInterval(this.balanceLoopIntervalId)
      this.balanceLoopIntervalId = null
    }
  }

  async init() {
    if (this.micRecorder.devices.length === 0) await this.micRecorder.init()
    return this
  }

  async startStream():Promise<void> {
  // Start streams without recording
    await this.micRecorder.startStream()
    await this.tabRecorder.startStream()

    // Ensure both streams are initialized
    if (!this.micRecorder.stream || !this.tabRecorder.stream) {
      throw new Error("Failed to initialize streams")
    }

    // Create an audio context to combine the streams
    this.audioContext = new AudioContext()
    this.destination = this.audioContext.createMediaStreamDestination()

    // Create source nodes
    const micSource = this.audioContext.createMediaStreamSource(this.micRecorder.stream)
    const tabSource = this.audioContext.createMediaStreamSource(this.tabRecorder.stream)

    // Create gain nodes
    this.gainNodeMic = this.audioContext.createGain()
    this.gainNodeTab = this.audioContext.createGain()

    // Create a channel merger node to combine different channels
    const channelMerger = this.audioContext.createChannelMerger(2) // 2 channels

    // Connect sources to their respective gain nodes
    micSource.connect(this.gainNodeMic)
    tabSource.connect(this.gainNodeTab)

    // Connect gain nodes to specific channels of the channel merger node
    this.gainNodeMic.connect(channelMerger, 0, 0) // Connect mic to channel 0 (left)
    this.gainNodeTab.connect(channelMerger, 0, 1) // Connect tab to channel 1 (right)

    // Connect the channel merger node to the destination
    channelMerger.connect(this.destination)

    // Use the destination's stream for recording
    this.outputStream = this.destination.stream
    this.startBalancingLoop()
  }

  async startCapture():Promise<void> {
    if (this.capturing) throw new Error("Already capturing")
    this.capturing = true
    this.audioChunks = []
    await this.startStream()
    if (!this.outputStream) throw new Error("Output stream not initialized")

    // Set up the media recorder for the combined stream
    this.mediaRecorder = new MediaRecorder(this.outputStream, {
      mimeType: "audio/webm; codecs=opus",
      bitsPerSecond: 128000,
      audioBitsPerSecond: 128000
    })

    this.mediaRecorder.ondataavailable = (event:BlobEvent) => {
      this.audioChunks.push(event.data)
      this.events.emit("data", event.data)
    }
    this.mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event)
    }
    this.mediaRecorder.start(1000)
  }

  stopCapture():void {
    if (!this.capturing) throw new Error("Not capturing")

    // Stop the media recorder
    if (this.mediaRecorder) {
      this.mediaRecorder.stop()
      this.mediaRecorder = null // Clear the recorder
    }

    // Stop both input streams
    this.micRecorder.stopStream()
    this.tabRecorder.stopStream()

    // Close the audio context
    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null // Clear the audio context
    }
    this.stopBalancingLoop()
    this.capturing = false
  }

  playRecording():void {
    if (this.audioChunks.length === 0) throw new Error("No audio to play")
    const audioBlob = new Blob(this.audioChunks, { type: "audio/webm; codecs=opus" })
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    audio.play().catch(err => console.error("Playback failed", err))
  }

  downloadRecording(filename = "combined_recording.webm"):void {
    if (this.audioChunks.length === 0) throw new Error("No audio to download")
    const audioBlob = new Blob(this.audioChunks, { type: "audio/webm; codecs=opus" })
    const audioUrl = URL.createObjectURL(audioBlob)
    const a = document.createElement("a")
    document.body.appendChild(a)
    a.style.display = "none"
    a.href = audioUrl
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(audioUrl)
    a.remove()
  }
}
