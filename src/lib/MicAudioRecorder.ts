import { getUserCaptureDevices } from "lib/captureUtil"
import { Ref, ref } from "vue"

export class MicAudioRecorder {
  private mediaRecorder:MediaRecorder | null = null
  stream:MediaStream | null = null
  audioChunks:Blob[] = []
  capturing = false
  selectedMicData:null | MediaDeviceInfo = null
  devices:MediaDeviceInfo[] = []

  selectMic(device:MediaDeviceInfo) {
    this.selectedMicData = device
  }

  async init() {
    const { defaultDeviceRealId, devices } = await getUserCaptureDevices()
    const defaultDevice = devices.find(device => device.deviceId === defaultDeviceRealId)
    this.devices = devices
    if (defaultDevice) this.selectMic(defaultDevice)
    console.log("MicAudioRecorder initialized", this.selectedMicData)
    return this
  }

  async startStream() {
    if (this.stream) throw new Error("Stream already started")
    if (!this.selectedMicData) throw new Error("Microphone not selected")

    const constraints = {
      audio: {
        deviceId: { exact: this.selectedMicData.deviceId },
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 48000,
        autoGainControl: true,
        sampleSize: 16,
        channelCount: 1
      }
    }
    this.stream = await navigator.mediaDevices.getUserMedia(constraints)
  }

  async startCapture() {
    this.capturing = true
    this.audioChunks = []
    await this.startStream()
    if (!this.stream) throw new Error("Stream not started")
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: "audio/webm; codecs=opus",
      bitsPerSecond: 128000,
      audioBitsPerSecond: 128000
    })

    this.mediaRecorder.ondataavailable = event => {
      this.audioChunks.push(event.data)
    }

    this.mediaRecorder.start(1000)
  }

  stopStream() {
    if (this.stream) this.stream.getTracks().forEach(track => track.stop())
    this.stream = null
  }

  stopCapture() {
    if (this.mediaRecorder) this.mediaRecorder.stop()
    this.stopStream()
    this.capturing = false
  }

  playRecording() {
    if (this.audioChunks.length === 0) throw new Error("No audio to play")
    const audioBlob = new Blob(this.audioChunks, { type: "audio/webm; codecs=opus" })
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    void audio.play()
  }

  downloadRecording(filename = "recording.webm") {
    if (this.audioChunks.length === 0) throw new Error("No audio to download")
    const audioBlob = new Blob(this.audioChunks, { type: "audio/webm; codecs=opus" })
    const audioUrl = URL.createObjectURL(audioBlob)
    const a = document.createElement("a")
    document.body.appendChild(a)
    a.setAttribute("style", "display: none")
    a.href = audioUrl
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(audioUrl)
    a.remove()
  }
}
