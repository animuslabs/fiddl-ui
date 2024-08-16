import { throwErr } from "lib/util"
import { makeTranscriptionChunks } from "src/lib/transcriptionUtil"

export async function getUserCaptureDevices():Promise<{devices:MediaDeviceInfo[], defaultDeviceRealId:string | null}> {
  await navigator.mediaDevices.getUserMedia({ audio: true })
  const devices = await navigator.mediaDevices.enumerateDevices()
  console.log("Devices:", devices)
  let defaultDeviceRealId:string | null = null

  // First, separate the 'default' device if it exists and get non-default devices
  const defaultDevice = devices.find(device => device.deviceId === "default")
  const nonDefaultDevices = devices.filter(device => device.deviceId !== "default")

  // Attempt to find the real device that the 'default' device refers to, by label
  if (defaultDevice) {
    const defaultDeviceLabelWithoutPrefix = defaultDevice.label.replace("Default - ", "")
    const realDefaultDevice = devices.find(device => device.label.includes(defaultDeviceLabelWithoutPrefix) && device.deviceId !== "default")

    // If found, use the real device's deviceId as the defaultDeviceRealId
    if (realDefaultDevice) {
      defaultDeviceRealId = realDefaultDevice.deviceId
    }
  }

  // Filter out duplicates among non-default devices, including finding the real default device
  const uniqueDevices = nonDefaultDevices.reduce((acc:MediaDeviceInfo[], current) => {
    if (!acc.find(item => item.deviceId === current.deviceId)) {
      acc.push(current)
    }
    return acc
  }, [])

  // Include the 'default' device in the list if it's not a duplicate
  if (defaultDevice && !uniqueDevices.some(device => device.deviceId === defaultDeviceRealId)) {
    uniqueDevices.push(defaultDevice)
  }

  // Filter to keep only audio input devices and sort by groupId
  const filteredAndSortedDevices = uniqueDevices.filter((el) => el.kind === "audioinput").sort((a, b) => a.groupId.localeCompare(b.groupId))

  return {
    devices: filteredAndSortedDevices,
    defaultDeviceRealId
  }
}



