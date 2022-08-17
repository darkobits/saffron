import createValidator from '@darkobits/valida';


export default {
  cosmiconfigOptions: createValidator(({ ow }) => ({
    spec: ow.object.partialShape({
      searchFrom: ow.optional.string,
      fileName: ow.string.nonEmpty,
      key: ow.optional.string
    })
  })),
  saffronCommand: createValidator(({ ow }) => ({
    spec: {
      command: ow.optional.string,
      description: ow.optional.string,
      strict: ow.optional.boolean,
      config: ow.any(ow.boolean.false, ow.object, ow.undefined),
      aliases: ow.any(ow.string, ow.array.ofType(ow.string), ow.undefined),
      builder: ow.optional.function,
      handler: ow.function
    }
  }))
};
