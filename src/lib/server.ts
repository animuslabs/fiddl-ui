import { initTRPC } from "@trpc/server"

const t = initTRPC.create()

const appRouter = t.router({
  hello: t.procedure.query(() => "hello world"),
})

export type AppRouter = typeof appRouter
