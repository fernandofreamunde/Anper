Welcome to

# ANPER

Anper is a framework for fast development/prototyping REST APIs with Node.js. It is built on top of Fastify uses TypeScript and Prisma. It is designed to be simple, fast, and easy to use.

## Why?

I created Anper because I'm lazy.

I come from the PHP world and I have been using Symfony for a long time. On that side of 'things' there is a great thing called [API Platform](https://api-platform.com/) that makes it really easy to create REST APIs. 

I wanted to have something similar for Node.js since I am learning node I figured it would be a great way to go a bit deeper into Fastify and Prisma. I also was building my own API  with just Fastify and Prisma and I was getting tired of writing the same code over and over again. Maybe I simply got too used to API Platform, maybe I'm just lazy...

I don't like everything about API Platform, but I love how simple it is to create the endpoints and how easy it is to customize them.

So I took the copy machine... I mean the inspiration machine and created Anper.

Development is still in early stages and I have no idea if this will ever be used by anyone else. But I'm having fun and learning a lot.

I would advise for now to not use this in production, since I did not write a single test yet and I don't know what kind of performance impact it will have on large applications.

That being said, if you want to try it out and give me some feedback, please do so. 

## Dependencies

At the moment this only requires Fastify and Prisma.  


## Installation

```bash
npm install @anper/anper
```

## Usage

### Registering Routes

You can register routes like you would normally do with Fastify, but you can also be lazy and generate all the routes for your models.

For that you will have to register your models, and then register the routes generated by Anper.

Well in order to Anper to know what models you have on your project you will have to register them. So on your app.ts you can register them like this:

```typescript
import { modelRegistry } from '@anper/anper'
import { Prisma } from '@prisma/client'
...
modelRegistry.register(Object.keys(Prisma.ModelName))
...
// register the generated routes with Fastify
app.register(apiRoutes)
```
It is just an array of strings with the module names so you could simply add the ones you want to use. But this is the best way, this way we add all of them.

### Access Control

Probably this should have a better name since we are actually telling Anper what routes with what methods we want to create. 

But since we are pass the hooks the name kinda fits... hence my naming choice.

~~Initially I was aiming to create all the routes for all the methods if no access rule was set. But eventually thought it would be better to have more control over it, and it made things simpler for me too.~~

Never mind I was drunk when I decided that, is the only explanation... not sure what I was thinking...

To register a rule, we have to use the `accessControlRegistry` like this:

```typescript

  accessControlRegistry.register({
    model: 'Users',
    methods: ['post', 'get', 'delete'],
    onRequestHooks: [],
  })

```
Model is the name of the model you want to add the access control to, methods is an array of the methods you routes to be created, and onRequestHooks is an array of Fastify hooks for example to verify the user is authenticated, or something like that.

So this example would allow the following routes to be created:
  
  ```
  POST /api/users
  GET /api/users
  GET /api/users/:id
  DELETE /api/users/:id
  ```

For the methods the following values are accepted: `post`, `get`, `get_item`, `get_collection`, `put`, `patch`, `delete`, `none`.

most of them we are familiar with some are strange btu straight forward. 
- `get` will create both item and collection routes,
- `get_item` is for the route that gets a single item, (example `/api/users/:id`).
- `get_collection` is for the route that gets a collection of items,
- `none` is for when you don't want to create any route for that model,


### Dto

Some times we want to allow a different data set to be the request body. Or we may want to have a different response body. For that we can use DTOs.

here is an example dto for an hypothetical user model, more specifically for the output:

```typescript
import { IDto, SupportsDtoParams } from '@anper/anper'
import { User } from '@prisma/client'

export interface UserOutputDto {
  id: string
  name: string
  email: string
  bio: string | null
  avatar_url: string | null
  created_at: Date
  updated_at: Date
}

export const userDto: IDto = {
  supports({ model }: SupportsDtoParams): boolean {
    return model === 'User'
  },

  async toDto(user: User): Promise<UserOutputDto> {

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      bio: user.bio,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }
  },

  async toDtoList(users: User[]): Promise<UserOutputDto[]> {
    return await Promise.all(users.map(async (user) => await this.toDto(user)))
  },
}

export default userDto
```

The `supports` method is used to tell Anper if this DTO supports the model. 

The `toDto` method is used to convert a single item to the DTO.

And the `toDtoList` method is used to convert a list of items to the DTO.

Then like with the access control we have to register the DTOs:

```typescript
import { dtoRegistry } from '@anper/anper'
import userDto from './dto/user.dto'
...
dtoRegistry.register(userDto)
```
### Filter

Anper also allows for filtering of the results. To define a filter we have to create a filter object that implements the `IFilter` interface from Anper.

This example is for a filter that allows to filter by email ending with a certain string. And is applied when you have a query parameter like this: `email-ew=example.com`

Some default filters will be added using the Prisma model fields, but that will have to come later.

Here we are returning the object like we would for a Prisma query.

```typescript
import { FilterParams, IFilter } from '@anper/anper'

class CustomFilterExample implements IFilter {
  supports({ model, queryItems }: FilterParams) {
    const keys = Object.keys(queryItems)

    return model === 'User' && keys.includes('email-ew')
  }

  getPrismaOptions({ queryItems }: FilterParams) {
    return {
      email: {
        endsWith: queryItems['email-ew'],
      },
    }
  }
}

const customFilter = new CustomFilterExample()
export default customFilter

```

then we have to register the filter:

```typescript
import { filterRegistry } from '@anper/anper'
import customFilter from './filters/custom.filter'
...
filterRegistry.register(customFilter)
```

### Validation

Anper also has a built in validation system, a simple one.

On a request, it will check if the fields on the data base are required, as in do they have a default value or not. 

If they don't have a default, then they are required. Like I said simple, almost rudimentary.

So you probably will need to have some custom validation for some of the models. 
By now you already have an idea of how Anper works. But here is the example:

```typescript
import * as z from 'zod'
import { IValidation } from '@anper/anper'

const userSchema = z.object({
  bio: z.string().min(10).max(100),
  email: z.string().email(),
  name: z.string().min(2).max(50),
  password: z.string().min(8).max(50),
})

const userValidator: IValidation = {
  model: 'User',
  validate: (data: any) => {
    try {
      const validatedData = userSchema.parse(data)
      return { errors: [], data: validatedData }
    } catch (error) {
      return { errors: [error.message], data: null }
    }
  },
}

export default userValidator
```

Here we are using zod to validate the data, but you can use whatever you want. This example will return the errors in a format that is not the same as Anper. So be careful with that.

In case you are wondering the validation from Anper simply return an array of strings with the errors in the format: `fieldName is required.`. Like I said simple... too simple.

In the future I plan to add a way to customize the error messages.

Then, obviously, we have to register the validator:

```typescript
import { validationRegistry } from '@anper/anper'
import userValidator from './validators/user.validator'
...
validationRegistry.register(userValidator)
```

## Custom Controllers

If you want to have more control over the routes you can create your own routes and controllers as you would normally do with Fastify.

But if you just want to hook into the routes created by Anper you can do that too.

The problem is that if you decide to do that, you also must validate the data and persist it your self.

Here is an example of a custom controller for user creation:

```typescript

class RegisterUserController implements IController {
  supports({ model, request }: ControllerParams) {
    const params = request.params as { id: string }
    return model === 'User' && request.method === 'POST' && !params.id
  }

  async process({ reply, request }: ControllerParams): Promise<void> {
    const registerBodySchema = z.object({
      name: z.string(),
      email: z.string().email(),
      password: z.string().min(6),
      bio: z.string().nullable(),
    })

    const { name, email, password, bio } = registerBodySchema.parse(
      request.body,
    )

    const password_hash = await hash(password, 8)

    user = await prisma.user.create({
      data: {
        name,
        email,
        password_hash,
        bio,
        created_at: new Date(),
      },
    })

    reply.status(201).send(user)
  }
}

const registerUserController = new RegisterUserController()
export default registerUserController

``` 

Then we have to register the controller:

```typescript
controllerRegistry.register(registerUserController)
```

## Author Notes

There is a lot to improve here, hence it is v0. Things I would like to implement in the near future:

- [ ] Add tests, for sake of fast development I did not test anything and that is very unprofessional.
- [ ] Add a way to customize the error messages.
- [ ] Somehow add a way to have sub resources, like `/api/users/:id/posts` and `/api/users/:id/posts/:id`.
- [ ] Add a way to customize the routes, like adding a prefix to all of them.
- [ ] Add auto Swagger documentation. The entire point of this all eventually is having that.
- [ ] If you create a Fastify route Anper will not know about it, if we have auto swagger docs we will need a way to add those routes to the docs.
- [ ] add support for GraphQL. this one is a nice to have...

## Regarding the name

Like GIF where the author wants it to be called JIF, that caused countless hours wasted how you should pronounce a word that is written with a G. I'm going to do the same.

Anper is read Anpfer I was hungry and ate the 'f'... I'm sorry.

It stands for: **A**noter **N**ode **P**risma **F**astify **E**ngine **R**est

I'm assuming there are other projects like this out there... after all this is the Js world. :)

