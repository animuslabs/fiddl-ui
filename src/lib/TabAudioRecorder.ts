import { throwErr } from "lib/util"

export class TabAudioRecorder {
  private mediaRecorder:MediaRecorder | null = null
  stream:MediaStream | null = null
  audioChunks:Blob[] = []
  capturing = false
  async startCapture() {
    if (this.capturing) throwErr("Already capturing")
    this.capturing = true
    this.audioChunks = []
    try {
      await this.startStream()
      if (!this.stream) throwErr("Stream not started")
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: "audio/webm;codecs=opus",
        bitsPerSecond: 256000,
        audioBitsPerSecond: 256000
      })


      this.mediaRecorder.ondataavailable = event => {
        console.log(event)
        this.audioChunks.push(event.data)
      }
      this.mediaRecorder.onerror = event => {
        console.error(event)
        this.stopCapture()
        this.capturing = false
      }

      this.mediaRecorder.start(1000)
    } catch (err) {
      console.error(err)
      this.stopCapture()
      this.capturing = false
    }
  }

  async startStream() {
    if (this.stream) throwErr("Stream already started")

    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 48000,
        autoGainControl: true,
        sampleSize: 16,
        channelCount: 1
      },
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      systemAudio: "include",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "exclude"
    } as any)

    const vid = this.stream.getVideoTracks()[0]
    if (vid) {
      vid.enabled = false
      this.stream.removeTrack(vid)
    }
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
    if (this.audioChunks.length === 0) throwErr("No audio to play")
    const audioBlob = new Blob(this.audioChunks, { type: "audio/webm; codecs=opus" })
    const audioUrl = URL.createObjectURL(audioBlob)
    const audio = new Audio(audioUrl)
    void audio.play()
  }

  downloadRecording(filename = "recording.webm") {
    if (this.audioChunks.length === 0) throwErr("No audio to download")
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
