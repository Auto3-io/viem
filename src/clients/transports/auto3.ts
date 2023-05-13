import { custom } from './custom.js'
import { type TransactionRequest } from '@auto3/common-schemas'
import { AsyncLocalStorage } from 'async_hooks'
import { getProgramRun, programRunLocalStorage } from 'internal-bridge'
import { z } from 'zod'

export const runKeyStorage = new AsyncLocalStorage<string>()

export function getRunKey() {
  return runKeyStorage.getStore()
}

export function runWithKey<T>(key: string, fn: () => T) {
  return runKeyStorage.run(key, fn)
}

export const ethResponseSchema = z.object({
  jsonrpc: z.string(),
  id: z.number(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
    })
    .optional(),
  result: z.any().optional(),
})

export async function sendTransaction(
  key: string,
  transaction: TransactionRequest,
): Promise<`0x{$string}`> {
  const programRun = programRunLocalStorage.getStore()

  if (!programRun) {
    throw new Error('Cannot call sendTransaction outside of a trigger run')
  }

  const resp = await programRun.sendTransaction(key, transaction)
  return resp.hash as `0x{$string}`
}

export async function performETHRequest(
  key: string,
  params: unknown,
): Promise<unknown> {
  const run = getProgramRun()

  if (!run) {
    throw new Error('Cannot call sendEmail outside of a trigger run')
  }

  if ((params as any)['method'] === 'eth_sendRawTransaction') {
    throw new Error('Cannot call eth_sendRawTransaction')
  }

  const output = await run.performRequest(key, {
    service: 'eth',
    endpoint: '',
    params,
    response: {
      schema: ethResponseSchema,
    },
  })

  return output.result
}

export const auto3 = custom({
  async request({ method, params }) {
    const stepKey = getRunKey()
    if (!stepKey) {
      throw new Error('No stepKey found')
    }

    const output = await performETHRequest(`${stepKey}:${method}`, {
      method,
      ...params,
    })
    return output
  },
})
