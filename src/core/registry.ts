import { Prisma, PrismaClient } from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { CoreController } from './controller'

export type ProcessorParams = {
  model: string
  request: FastifyRequest
  reply: FastifyReply
}

export type SupportsProcessorParams = {
  model: string
  request: FastifyRequest
}

export interface IProcessor {
  supports: (params: SupportsProcessorParams) => boolean
  process: (params: ProcessorParams) => Promise<void>
}

class ControllerRegistry {
  private processors: IProcessor[] = []
  private coreController: CoreController

  public register(processor: IProcessor) {
    this.processors.push(processor)
  }

  public registerCore(processor: CoreController) {
    this.coreController = processor
  }

  public async getProcessorFor(params: SupportsProcessorParams) {
    return await this.processors.find((processor) => processor.supports(params))
  }

  public getCoreController(): CoreController {
    return this.coreController
  }
}

export const controllerRegistry = new ControllerRegistry()

/// ----------------------------

export type FilterParams = {
  model: string
  queryItems: any
}

export type SupportsFilterParams = {
  model: string
  queryItems: any
}

export interface IFilter {
  supports: (params: SupportsFilterParams) => boolean
  getPrismaOptions: (params: FilterParams) => any
}

class FilterRegistry {
  private filters: IFilter[] = []

  public register(filter: IFilter) {
    this.filters.push(filter)
  }

  public getFilterFor(params: SupportsFilterParams) {
    return this.filters.filter((filter) => filter.supports(params))
  }
}

export const filterRegistry = new FilterRegistry()

/// ----------------------------

export type SupportsDtoParams = {
  model: string
}

export interface IDto {
  supports: (params: SupportsDtoParams) => boolean
  toDto: (params: any) => Promise<any>
  toDtoList: (params: any[]) => Promise<any>
}

class DtoRegistry {
  private dtos: IDto[] = []

  public register(filter: IDto) {
    this.dtos.push(filter)
  }

  public getDtoFor(params: SupportsDtoParams) {
    return this.dtos.find((dto) => dto.supports(params))
  }
}

export const dtoRegistry = new DtoRegistry()

/// ----------------------------

export type RequestMethod =
  | 'get'
  | 'get_item'
  | 'get_collection'
  | 'post'
  | 'put'
  | 'patch'
  | 'delete'
  | 'all'
  | 'none'

export interface IAccessRule {
  model: string
  methods: RequestMethod[]
  onRequestHooks: any[]
}

class AccessControlRegistry {
  private accessRules: IAccessRule[] = []

  public register(rule: IAccessRule) {
    this.accessRules.push(rule)
  }

  public registerRules(rules: IAccessRule[]) {
    this.accessRules = [...this.accessRules, ...rules]
  }

  public getAccessRulesFor(model: string): any[] {
    return this.accessRules.filter((rule) => rule.model === model)
  }
}

export const accessControlRegistry = new AccessControlRegistry()

/// ----------------------------

export interface IValidation {
  model: string
  validate: (data: any) => { errors: string[]; data: any }
}

class ValidationRegistry {
  private validations: IValidation[] = []

  public register(rule: IValidation) {
    this.validations.push(rule)
  }

  public getValidationFor(model: string): any {
    return this.validations.find((rule) => rule.model === model)
  }
}

export const validationRegistry = new ValidationRegistry()

/// ----------------------------

class ModelRegistry {
  private models: string[] = []
  private client: PrismaClient

  public register(client: PrismaClient) {
    this.models = Object.keys(Prisma.ModelName)
    client.category.findMany().then(console.log)
    this.client = client
    controllerRegistry.registerCore(new CoreController(client))
  }

  public getModels(): string[] {
    return this.models
  }

  public getClient(): PrismaClient {
    return this.client
  }
}

export const modelRegistry = new ModelRegistry()
