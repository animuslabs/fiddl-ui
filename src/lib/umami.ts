// @ts-expect-error umami should be setup in index
const Umami = window.umami

const umami = {
  identify(data: { userId: string; userName?: string }) {
    Umami?.identify(data)
  },
  track(eventName: string, data?: Record<string, any>) {
    Umami?.track(eventName, data)
  },
}
export default umami
