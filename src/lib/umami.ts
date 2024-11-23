// @ts-expect-error umami should be setup in index
const Umami = window.umami
//@ts-ignore
if (window.location.hostname === "localhost") localStorage.setItem("umami.disabled", 1)
else localStorage.removeItem("umami.disabled")

const umami = {
  identify(data: { userId: string; userName?: string }) {
    Umami?.identify(data)
  },
  track(eventName: string, data?: Record<string, any>) {
    Umami?.track(eventName, data)
  },
}
export default umami
