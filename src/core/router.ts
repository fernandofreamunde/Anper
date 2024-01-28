import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  RequestMethod,
  accessControlRegistry,
  IAccessRule,
  controllerRegistry,
  modelRegistry,
} from './registry'
import controller from './controller'

export async function apiRoutes(app: FastifyInstance) {
  const prismaModels = modelRegistry.getModels()

  prismaModels.forEach((model) => {
    const modelAccessRules = accessControlRegistry.getAccessRulesFor(model)

    const none = modelAccessRules.filter((rule) =>
      rule.methods.includes('none'),
    )

    if (none.length > 0) {
      return
    }

    // then check if there is a mapper/dto for transformation/hiding of fields and validation
    if (shouldAddRoute(modelAccessRules, 'post', model)) {
      const postHooks = getHooksFor(modelAccessRules, 'post')

      app.post(
        `/api/${model.toLowerCase()}`,
        { onRequest: postHooks },
        async function (request, reply) {
          await getProcessorFor(model, request, reply)
        },
      )
    }

    if (shouldAddRoute(modelAccessRules, 'get_collection', model)) {
      const getCollectionHooks = getHooksFor(modelAccessRules, 'get_collection')

      app.get(
        `/api/${model.toLowerCase()}`,
        { onRequest: getCollectionHooks },
        async function (request, reply) {
          await getProcessorFor(model, request, reply)
        },
      )
    }

    if (shouldAddRoute(modelAccessRules, 'get_item', model)) {
      const itemHooks = getHooksFor(modelAccessRules, 'get_item')

      app.get(
        `/api/${model.toLowerCase()}/:id`,
        { onRequest: itemHooks },
        async function (request, reply) {
          await getProcessorFor(model, request, reply)
        },
      )
    }

    if (shouldAddRoute(modelAccessRules, 'put', model)) {
      const putHooks = getHooksFor(modelAccessRules, 'put')

      app.put(
        `/api/${model.toLowerCase()}/:id`,
        { onRequest: putHooks },
        async function (request, reply) {
          await getProcessorFor(model, request, reply)
        },
      )
    }

    if (shouldAddRoute(modelAccessRules, 'patch', model)) {
      const patchHooks = getHooksFor(modelAccessRules, 'patch')

      app.patch(
        `/api/${model.toLowerCase()}/:id`,
        { onRequest: patchHooks },
        async function (request, reply) {
          await getProcessorFor(model, request, reply)
        },
      )
    }

    if (shouldAddRoute(modelAccessRules, 'delete', model)) {
      const deleteHooks = getHooksFor(modelAccessRules, 'delete')

      app.delete(
        `/api/${model.toLowerCase()}/:id`,
        { onRequest: deleteHooks },
        async function (request, reply) {
          await getProcessorFor(model, request, reply)
        },
      )
    }
  })
}

/**
 * This function will check if there is a custom processor for the request type
 * if not it will use the default processor
 * @param model string
 * @param request FastifyRequest
 * @param reply FastifyReply
 * @returns Promise<void>
 */
async function getProcessorFor(
  model: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const processor = await controllerRegistry.getProcessorFor({
    model,
    request,
  })

  if (processor) {
    await processor.process({ model, request, reply })
    return
  }

  await controller.process({ model, request, reply })
}

/**
 * This function will check if there is a hook for the request type
 * if not it will use no hook
 */
function getHooksFor(modelAccessRules: IAccessRule[], method: RequestMethod) {
  const hooks = modelAccessRules
    .filter((rule) => {
      if (method === 'get_item' || method === 'get_collection') {
        return (
          rule.methods.includes(method) ||
          rule.methods.includes('get') ||
          rule.methods.includes('all')
        )
      } else {
        return rule.methods.includes(method) || rule.methods.includes('all')
      }
    })
    .map((rule) => rule.onRequestHooks)
    .flat()

  return hooks
}

function shouldAddRoute(
  modelAccessRules: IAccessRule[],
  method: RequestMethod,
  model: string,
) {
  // if there are no rules for the given model enable all methods
  const existingModelRules = modelAccessRules.filter((rule) => rule.model === model)
  if (existingModelRules.length === 0) {
    return true
  }
  
  if (modelAccessRules.some((rule) => rule.methods.includes('none'))) {
    return false
  }

  if (method === 'get_item' || method === 'get_collection') {
    return modelAccessRules.some(
      (rule) => rule.methods.includes(method) || rule.methods.includes('get'),
    )
  }

  return modelAccessRules.some((rule) => rule.methods.includes(method))
}
