import {
  ProcessorParams,
  dtoRegistry,
  filterRegistry,
  modelRegistry,
  validationRegistry,
} from './registry'
import { PrismaClient } from '@prisma/client'

export interface ICoreController {
  process: (params: ProcessorParams) => Promise<void>
}

export class CoreController implements ICoreController {
  
  constructor(private prisma: PrismaClient) {
    // this.prisma = modelRegistry.getClient()
  }

  async process({ model, reply, request }: ProcessorParams): Promise<any> {
    console.log('we are processing')
    const prismaModel = this.prisma[model] as any

    console.log('we are processingsss')
    // console.log(prismaModel)
    const params = request.params as { id: string }
    const body = request.body ?? {}
    const query = request.query ?? ({} as any)

    let data = null

    if (request.method === 'GET' && !params.id) {
      data = await this.fetchCollection(model, query)
      reply.status(200).send(data)
      return
    }

    if (request.method === 'POST') {
      await this.createItem(model, body, reply)
      return
    }

    if (!params.id) {
      // we declare the route is not found from this point on the routes need the :id param
      reply.status(404).send({ message: 'Not found' })
    }

    const item = await this.fetchItem(model, params.id, reply)

    if (!item && request.method !== 'PUT') {
      reply.status(404).send({ message: 'Not found' })
    }
    
    if (request.method === 'GET') {
      const mapper = dtoRegistry.getDtoFor({ model })
      
      if (mapper) {
        data = await mapper.toDto(item)
      } else {
        data = item
      }
      
      reply.status(200).send(data)
      return
    }
    
    if (request.method === 'PUT' && !item) {
      (body as any).id = params.id
      await this.createItem(model, body, reply)
      return
    }

    if (request.method === 'PUT' && item) {
      const { errors, data: validData } = this.validate(body, model)

      if (errors.length > 0) {
        reply.status(400).send({ errors })
        return
      }

      await prismaModel.update({
        data: validData,
        where: {
          id: params.id,
        },
      })

      reply.status(204)
      return
    }

    if (request.method === 'PATCH') {
      for (const [key, value] of Object.entries(body)) {
        item[key] = value
      }

      const { errors, data: validData } = this.validate(item, model)

      if (errors.length > 0) {
        reply.status(400).send({ errors })
        return
      }

      await prismaModel.update({
        data: validData,
        where: {
          id: params.id,
        },
      })

      reply.status(204)
      return
    }

    if (request.method === 'DELETE') {
      await prismaModel.delete({
        where: {
          id: params.id,
        },
      })

      reply.status(204)
    }

    reply.status(404).send({ message: 'Not found' })
    
  }

  /**
   * Adds simple validation to the default processor.
   *
   * Validate will simply check if the data has all the
   * required fields according to the database schema
   * will not validate sub resources/related data only
   * ask for the relation id
   *
   * @param data any
   * @param model string
   * @param isCreate boolean
   * @returns string[]
   */
  validate(data: any, model: string): { errors: string[]; data: any } {
    const errors: string[] = []

    const customValidation = validationRegistry.getValidationFor(model)

    if (customValidation) {
      return customValidation.validate(data)
    }

    const modelFields = this.getModelFields(model)

    var validData = {}
    // check if data has all the required fields
    // if not throw an error
    modelFields?.forEach((field) => {
      // id is not needed
      if (field.isId) {
        return
      }

      if (field.hasDefaultValue) {
        return
      }

      if (field.kind === 'object') {
        return
      }      

      if (field.isRequired && !data[field.name]) {
        errors.push(`${field.name} is required`)
      }

      // parse the data to the correct type
      if (this.prisma[model].fields[field].typeName == "Int") {
        validData[field] = parseInt(data[field])
      } else if (this.prisma[model].fields[field].typeName == "Float") {
        validData[field] = parseFloat(data[field])
      } else {
        validData[field] = data[field]
      }
    })

    return { errors, data: validData }
  }

  getSortingOptions(model, query): any {
    const fields = this.getModelFields(model)
    const keys = Object.keys(query)

    const sortingOptions = keys
      .filter((key) => {
        const field = fields.find((f) => f.name === key)
        return field
      })
      .map((key) => {
        return {
          [key]: query[key] === 'asc' ? 'asc' : 'desc',
        }
      })

    return sortingOptions
  }

  getModelFields(model: string): any {
    return Object.keys(this.prisma[model].fields)
  }

  getCustomFilters(model: string, queryItems: any): any {
    const filters = filterRegistry.getFilterFor({ model, queryItems })

    return filters.map((filter) =>
      filter.getPrismaOptions({ model, queryItems }),
    )
  }

  async fetchItem(model, id, reply): Promise<any> {
    const prismaModel = this.prisma[model] as any

    const data = await prismaModel.findUnique({
      where: {
        id,
      },
    })

    return data
  }

  async createItem(model, body, reply) {
    const prismaModel = this.prisma[model] as any
    const { errors, data: validData } = this.validate(body, model)

    if (errors.length > 0) {
      reply.status(400).send({ errors })
    }

    if (body.id) {
      validData.id = body.id
    }

    try {
      let data = await prismaModel.create({ data: validData })

      const mapper = dtoRegistry.getDtoFor(model)
  
      if (mapper) {
        data = await mapper.toDto(data)
      }
  
      reply.status(201).send(data)
      
    } catch (error) {
      //  use regex to find if the error is a unique constraint error
      var dd = /Unique constraint failed on the fields:\s\((`.+`)\)/gm
      var r = error.message.match(dd);
      if (r) {
        var dd = /\((`.+`)\)/gm
        var r = error.message.match(dd);
        var fields = r[0].replace('(', '').replace(')', '')
        reply.status(400).send({ errors: [`${fields} already taken`] })
      }

      //  use regex to find if the error is a missing argument
      var dd = /Argument (`.+`) is missing./gm
      var r = error.message.match(dd);
      if (r) {
        reply.status(400).send({ errors: [`${r}`] })
      }
      
      reply.status(400).send({ errors: "Something went wrong."})
    }
    reply.status(400).send({ errors: "Something went wrong."})
  }

  setPagination(query: any): { take: number; skip: number } {
    const page = query?.page ? parseInt(query.page as string) : 1
    const limit = query?.limit ? parseInt(query.limit as string) : 10
    // make the max limit 30
    const take = limit > 30 ? 30 : limit
    const skip = (page - 1) * limit

    return { take, skip }
  }

  async fetchCollection(model, query): Promise<any> {
    console.log('we are here')
    const prismaModel = this.prisma[model] as any
    const filters = this.getCustomFilters(model, query)
    const orderBy = this.getSortingOptions(model, query)
    const { take, skip } = this.setPagination(query)
    let data = null

    if (filters.length > 0) {
      data = await prismaModel.findMany({
        where: {
          OR: filters,
        },
        orderBy,
        skip,
        take,
      })
    } else {
      data = await prismaModel.findMany({
        orderBy,
        skip,
        take,
      })
    }

    const mapper = dtoRegistry.getDtoFor({ model })

    if (mapper) {
      data = await mapper.toDtoList(data)
    }

    return data
  }
}

// const coreController = new CoreController()
// export default coreController
