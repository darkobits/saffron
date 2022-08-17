import createValidator from '@darkobits/valida';


export default {
  cosmiconfigOptions: createValidator(({ ow }) => ({
    spec: ow.object.partialShape({
      auto: ow.optional.boolean,
      searchFrom: ow.optional.string,
      fileName: ow.string.nonEmpty,
      key: ow.optional.string
    })
  })),
  saffronCommand: createValidator(({ ow }) => ({
    spec: {
      command: ow.optional.string.nonEmpty,
      description: ow.optional.string.nonEmpty,
      aliases: ow.any(ow.string, ow.array.ofType(ow.string), ow.undefined),
      strict: ow.optional.boolean,
      config: ow.optional.any(ow.boolean.false, ow.object),
      builder: ow.optional.function,
      handler: ow.function
    }
  }))
};
