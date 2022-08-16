<a href="#top" id="top">
  <img src="https://user-images.githubusercontent.com/441546/101694946-bda8ef00-3a28-11eb-8d4f-e3629fd94d4c.png" style="max-width: 100%;">
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/saffron"><img src="https://img.shields.io/npm/v/@darkobits/saffron.svg?style=flat-square"></a>
  <a href="https://github.com/darkobits/saffron/actions?query=workflow%3ACI"><img src="https://img.shields.io/github/workflow/status/darkobits/saffron/CI/master?style=flat-square"></a>
  <a href="https://depfu.com/github/darkobits/saffron"><img src="https://img.shields.io/depfu/darkobits/saffron?style=flat-square"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/static/v1?label=commits&message=conventional&style=flat-square&color=398AFB"></a>
</p>

Saffron is an opinionated integration between [Yargs][github:yargs] and [Cosmiconfig][github:cosmiconfig],
two best-in-class tools for building robust command-line applications in Node. General familiarity with
these tools is recommended before using Saffron.

The core feature of Saffron is the utilization of [`yargs.config()`][yargs.config] to pass data loaded
by Cosmiconfig into Yargs, where Yargs can then perform normalization, validation, and set defaults...
all in one place.

In addition to this, Saffron applies some opinionated settings to both Yargs and Cosmiconfig to
encourage consistency and best practices.

* [Rationale](#rationale)
* [Install](#install)
* [Getting Started](#getting-started)
* [API](#api)
  * [`command`](#commandconfig-saffroncommand-void)
  * [`init`](#init)
* [TypeScript Integration](#typescript-integration)
* [Caveats](#caveats)
* [Addenda](#addenda)

# Rationale

Yargs is arguably the best command-line argument parser in the Node ecosystem. However, its API has
grown tremendously over the years to support the myriad idiosyncratic use-cases of its users, leading to
bloat. And while it does have limited support for loading configuration files, it only supports files in
the JSON format.

Saffron focuses on what it thinks is the most flexible, robust Yargs API, the [command module API][github:command-module-api],
which supports almost every Yargs use-case while only involving a single Yargs method (`.command()`).

Cosmiconfig is an extremely powerful and configurable utility for adding support for configuration files
to an application in several different formats, giving users the ability to choose between JSON, YAML,
and JavaScript-based configuration files with a single tool.

Saffron aims to integrate these two tools, solving for many common cases, applying sensible defaults
where it can, and generally making it as easy as possible to write robust CLIs in as few lines of code
as possible.

# Install

To install Saffron:

```
npm install @darkobits/saffron
```

# Getting Started

Let's imagine we are building a CLI that will help us reticulate splines. The CLI has the following
requirements:

* It must be provided 1 positional argument, `spline`, indicating the spline to
  be reticulated.
* It may be provided 1 optional named argument, `algorithm`, indicating the
  reticulation algorithm to use. Valid algorithms are `RTA-20`, `RTA-21`, and
  `RTA-22`. If omitted, the default algorithm should be `RTA-21`.
* These options may be provided as command-line arguments or supplied via a
  configuration file, `.spline-reticulator.yml` located in or above the user's
  current directory.

Let's build-out a quick CLI for this application to make sure options/arguments are being processed per
the above requirements.

> `package.json (abridged)`

```json
{
  "name": "@fluffykins/spline-reticulator",
  "version": "0.1.0",
  "description": "Reticulates splines using various algorithms.",
  "dependencies": {
    "@darkobits/saffron": "^X.Y.Z"
  }
}
```

> `cli.js`

```ts
import cli from '@darkobits/saffron';

cli.command({
  command: '* <spline>',
  builder: ({command}) => {
    // Add some additional information about the "spline" positional argument.
    command.positional('spline', {
      description: 'Identifier of the spline to reticulate.',
      type: 'string'
    });

    // Define the "algorithm" named argument.
    command.option('algorithm', {
      description: 'Reticulation algorithm to use.',
      type: 'string',
      required: false,
      enum: ['RTA-20', 'RTA-21', 'RTA-22'],
      default: 'RTA-21'
    });
  },
  handler: ({argv}) => {
    // This is where we would normally call our application's main function, but
    // let's just log the configuration we got from Saffron.
    console.log(argv);
  }
})

// Once we have registered all commands for our application, be sure
// to call init.
cli.init();
```

First, lets try invoking `spline-reticulator --help` to make sure our usage instructions look okay:

> `Command Line`

```
$ spline-reticulator --help

spline-reticulator <spline>

Reticulates splines using various algorithms.

Positionals:
  spline  Identifier of the spline to reticulate.                                               [string]

Options:
  --algorithm    Reticulation algorithm to use.
                                    [string] [choices: "RTA-20", "RTA-21", "RTA-22"] [default: "RTA-21"]
  -v, --version  Show version number                                                           [boolean]
  -h, --help     Show help                                                                     [boolean]
```

Notice that the description used above was derived from the `description` field of our `package.json`.
This is a sensible default, but can be customized by providing a `description` option in our command
definition.

We can verify that our CLI works as expected by calling it in various ways, and ensuring it uses a
configuration file when present:

> `Command Line`

```
$ spline-reticulator 402B

{
  '$0': 'spline-reticulator',
  _: [],
  spline: '402B'
  algorithm: 'RTA-21',
}
```

Because this invocation was valid, Yargs invoked our handler, which logged-out the parsed arguments
object. Let's provide an invalid algorithm and ensure that Yargs catches this mistake:

> `Command Line`

```
$ spline-reticulator 402B --algorithm RTA-16

spline-reticulator <spline>

Reticulates splines using various algorithms.

Positionals:
  spline  Identifier of the spline to reticulate.                                               [string]

Options:
  --algorithm    Reticulation algorithm to use.
                                    [string] [choices: "RTA-20", "RTA-21", "RTA-22"] [default: "RTA-21"]
  -v, --version  Show version number                                                           [boolean]
  -h, --help     Show help                                                                     [boolean]

Invalid values:
  Argument: algorithm, Given: "RTA-16", Choices: "RTA-20", "RTA-21", "RTA-22"
```

Notice the `Invalid values:` section at the end, indicating the erroneous reticulation algorithm.

Let's try adding a configuration file and ensure that Saffron loads it correctly. By default, Saffron
will use the un-scoped portion of the `name` field from your project's `package.json` -- that is, the
part after the `/` or the entire name if it doesn't have a scope. Since our package is named
`@fluffykins/spline-reticulator`, Saffron will use `spline-reticulator` as the base name when searching
for configuration files. One of the default supported configuration file types would thus be
`.spline-reticulator.yml`. If this file is found in or above the directory from which we invoked our
application, it would be loaded and merged with any arguments provided.

> `.spline-reticulator.yml`

```yml
algorithm: RTA-22
```

> `Command Line`

```
$ spline-reticulator 402B

{
  '$0': 'spline-reticulator'
  _: [],
  spline: '402B',
  algorithm: 'RTA-22',
}
```

Notice we did not provide an `--algorithm` argument, and the default algorithm `RTA-21` has been
superseded by `RTA-22`, which was loaded from our `.spline-reticulator.yml` file. Wowza!

For more information about supported configuration file formats, see the [`config.searchPlaces`](https://github.com/darkobits/saffron#configsearchplaces)
option.

# API

Saffron exports two functions: `command` and `init`. The `command` function is almost identical to
Yargs' `command()` function (object form) with several additional options. The `init` function is
analogous to "calling" `yargs.argv` to initialize the argument parser.

When building CLIs with Saffron, `command` must be called once for each command the application needs to
register. Then, `init` must be called to initialize the application.

## `command(config: SaffronCommand): void`

Saffron's `command` function accepts a single object, [`SaffronCommand`][SaffronCommand]. The API for
which is very similar to that of Yargs' [command module API][github:command-module-api], which
configures each command for an application using a single object as opposed to the more idiomatic Yargs
approach of chaining method calls.

A [`SaffronCommand`][SaffronCommand] may have the following keys:

### `command`

| Type     | Required | Default |
|----------|----------|---------|
| `string` | No       | `'*'`    |

Name of the command being implemented. If the application only implements a "root" command and does not
take any positional arguments, this option can be omitted. If the application takes positional
arguments, they _must_ be defined here using `<>` to wrap required arguments and `[]` to wrap optional
arguments. Positionals may then be further annotated in the builder function using [`.positional`][github:yargs-positional-options].

See: [Positional Arguments][github:yargs-positional-arguments]

> **Note** This option is a pass-through to Yargs' `command` option.

**Example:**

The following example illustrates how to define required and optional positional arguments in `command`
and how to further annotate them in `builder` (documented below):

```ts
import cli from '@darkobits/saffron';

cli.command({
  command: '* <requiredPositional> [optionalPositional]',
  builder: ({ command }) => {
    command.positional('requiredPositional', {
      // ...
    });

    command.positional('optionalPositional', {
      // ...
    });

    // Only positionals need to be defined in the `command` expression; flags
    // ony need to be defined here.
    command.option('someFlag', {
      // ...
    });
  }
});
```

[![hr][hr]](#top)

### `aliases`

| Type            | Required | Default |
|-----------------|----------|---------|
| `Array<string>` | No       | N/A     |

Only practical when implementing sub-commands, this option allows you to specify a list of aliases for
the command.

See: [Command Aliases][github:yargs-command-aliases]

> **Note** This option is a pass-through to Yargs' `aliases` option.

**Example:**

This example will alias the "serve" command to "s":

```ts
import cli from '@darkobits/saffron';

cli.command({
  command: 'serve',
  aliases: ['s']
});
```

[![hr][hr]](#top)

### `description`

| Type     | Required | Default    |
|----------|----------|------------|
| `string` | No       | See below. |

Description for the command. If left blank, Saffron will use the `description` field from your project's
`package.json`.

Note that if you use [`.usage()`][github:yargs-command-description] in your builder function, it will
override this description.

> **Note** This option is a pass-through to Yargs' `describe` option.

**Example:**

```ts
import cli from '@darkobits/saffron';

cli.command({
  description: 'Make it rain.'
});
```

[![hr][hr]](#top)

### [`config`][SaffronCommand.config]

| Type                                                               | Required | Default    |
|--------------------------------------------------------------------|----------|------------|
| [`SaffronCosmiconfigOptions`][SaffronCosmiconfigOptions] │ `false` | No       | See below. |

Settings for Cosmiconfig, which is responsible for locating and parsing an application's configuration
file. In addition to the below options, this object may contain any valid [Cosmiconfig option][cosmiconfig.Options].

Alternatively, this option may be set to `false` to disable configuration file support entirely.

#### [`config.auto`][SaffronCommand.config.auto]

| Type      | Required | Default |
|-----------|----------|---------|
| `boolean` | No       | `true`  |

By default, after loading an application's configuration file, Saffron will call Yargs' `.config()`
method, passing it the data from the configuration file. This will have the effect of allowing
configuration data to serve as default values for any arguments the application accepts. This is
referred to as auto-configuration.

If an application's command-line argument schema and configuration schema differ, auto-configuration
would not be desirable. In such cases, `auto` may be set to `false`, and Saffron will only load an
application's configuration file and pass its contents to `builder` and `handler` functions without
calling `.config()`.

**Example:**

```ts
import cli from '@darkobits/saffron';

cli.command({
  config: {
    auto: false
  }
});
```

#### [`config.fileName`][SaffronCommand.config.fileName]

| Type     | Required | Default    |
|----------|----------|------------|
| `string` | No       | See below. |

By default, Saffron will use the un-scoped portion of an application's name from its `package.json`.
If you would prefer to use a different base name for configuration files, you may provide your own
`fileName` option. This is equivalent to the `moduleName` value used [throughout the Cosmiconfig documentation][github:cosmiconfig-usage].

**Example:**

```ts
import cli from '@darkobits/saffron';

cli.command({
  config: {
    // Look for files like .my-app.yml, my-app.config.js, etc.
    fileName: 'my-app'
  }
})
```

#### [`config.key`][SaffronCommand.config.key]

| Type     | Required | Default |
|----------|----------|---------|
| `string` | No       | N/A     |

For complex applications with multiple commands, it may be desirable to scope configuration for a
particular command to a matching key in the application's configuration file. If this option is set,
Saffron will only use data under this key (rather than the entire file) to configure the command.

**Example:**

```ts
import cli from '@darkobits/saffron';

cli.command({
  command: 'serve',
  config: {
    // Tell Saffron to apply configuration at this key in users' configuration object to this command.
    key: 'serve'
  }
})
```

#### `config.searchFrom`

| Type     | Required | Default         |
|----------|----------|-----------------|
| `string` | No       | `process.cwd()` |

Directory to begin searching for a configuration file. Cosmiconfig will then walk up the directory tree
from this location until a configuration file is found or the root is reached.

#### `config.searchPlaces`

| Type            | Required | Default    |
|-----------------|----------|------------|
| `Array<string>` | No       | See below. |

Saffron overrides the default [`searchPlaces` option in Cosmiconfig][github:cosmiconfig-search-places]
with the below defaults, where `fileName` is the base file name for your application as derived from
`package.json` or as indicated at `config.fileName` (see above). Using our example package name of
`@fluffykins/spline-reticulator`, the below snippet has been annotated with examples of the exact file
names Saffron would tell Cosmiconfig to search for.

```js
[
  // Look for a "spline-reticulator" key in package.json.
  'package.json',
  // Look for .spline-reticulator.json in JSON format.
  `.${fileName}.json`,
  // Look for .spline-reticulator.yaml in YAML format.
  `.${fileName}.yaml`,
  // Look for .spline-reticulator.yml in YAML format.
  `.${fileName}.yml`,
  // Look for spline-reticulator.config.js that should have a default export.
  `${fileName}.config.js`
];
```

For comparison, the default Cosmiconfig `searchPlaces` can be found [here][github:cosmiconfig-search-places].

[![hr][hr]](#top)

### `strict`

| Type      | Required | Default |
|-----------|----------|---------|
| `boolean` | No       | `true`  |

Whether to configure Yargs to use strict mode. In strict mode, any additional options passed via the CLI
or found in a configuration file will cause Yargs to exit the program and report an error. This is
generally a good idea because it helps catch typos from user input.

However, if your application's configuration file supports more options than you
would like to consume via the CLI, then you will need to disable strict mode.
Also be aware that because these additional options will not be defined in your
builder, Yargs will not perform any validation on them.

[![hr][hr]](#top)

### `builder`

| Type                               | Required | Default |
|------------------------------------|----------|---------|
| [`SaffronBuilder`][SaffronBuilder] | No       | N/A     |

This function allows a command to be configured and annotated. The API exposed by this object is almost
identical to the [Yargs command module API][github:command-module-api], but the context is scoped to the
command defined by `command`, making this API preferable to using the global Yargs object. The
[.positional()][[github:yargs-positional-options]] and [.option()][github:yargs-option-options] methods
will be the most-used in your builder to define the arguments for the command.

Saffron builders are passed a single object, [`SaffronBuilderContext`][SaffronBuilderContext] which
has the following properties:

| Property   | Type                                                      | Description                                                                       |
|:-----------|:----------------------------------------------------------|:----------------------------------------------------------------------------------|
| `command`  | [`yargs.Argv`][yargs.Argv]                                | Yargs command builder API.                                                        |
| `pkg.json` | [`NormalizedPackageJson`][read-pkg.NormalizedPackageJson] | Normalized `package.json` for the application.                                    |
| `pkg.root` | `string`                                                  | Absolute path to the application's root (the directory containing `package.json`) |

**Example:**

```ts
import cli from '@darkobits/saffron';

cli.command({
  builder: ({ command, pkg }) => {
    // Configure command.
  }
});
```

[![hr][hr]](#top)

### `handler`

| Type                               | Required | Default |
|:-----------------------------------|:---------|:--------|
| [`SaffronHandler`][SaffronHandler] | Yes      | N/A     |

This function is responsible for implementing a command. It is invoked at the end of Saffron's lifecycle
once configuration has been loaded, validated, and merged onto CLI arguments -- if configured. It is
similar to the `handler` option used when defining a Yargs command module.

Saffron handlers are passed a single object, [`SaffronHandlerContext`][SaffronHandlerContext], which
has the following properties:

| Property        | Type                                                      | Description                                                                                                  |
|:----------------|:----------------------------------------------------------|:-------------------------------------------------------------------------------------------------------------|
| `argv`          | [`yargs.Arguments`][yargs.Arguments]                      | Parsed/merged/validated arguments/configuration from Yargs and Cosmiconfig.                                  |
| `config`        | `any`                                                     | Parsed configuration file.                                                                                   |
| `configPath`    | `string` | `undefined`                                    | Path where Cosmiconfig found a configuration file, if any.                                                   |
| `configIsEmpty` | `boolean`                                                 | `true` if a configuration file was found, but was empty. It is often a good idea to warn users in this case. |
| `pkg.json`      | [`NormalizedPackageJson`][read-pkg.NormalizedPackageJson] | Parsed and [normalized][github:package-normalization] `package.json` for the application.                    |
| `packageRoot`   | `string`                                                  | Absolute path to the application's root directory (the directory containing `package.json`).                 |

[![hr][hr]](#top)

## `init(cb?: `SaffronInitCallback`): void`

This function must be called after all commands have been configured. It will then parse `process.argv`
to initialize the Yargs parser, equivalent to accessing `yargs.argv`.

This function sets the following global parameters:

- Calls [`yargs.version`][yargs.version] with the version from the application's `package.json`,
  ensuring that if the application is invoked with the `--version` option, Yargs will print the correct
  version.
- Calls [`yargs.wrap`][yargs.wrap] with [`yargs.terminalWidth()`][yargs.terminalWidth] to instruct Yargs
  to use the full width of the terminal before wrapping lines.
- Calls [`yargs.help`][yargs.help], ensuring that if the application is invoked with the `--help` flag,
  Yargs will print usage instructions and exit.

It accepts an optional callback, [`SaffronInitCallback`][SaffronInitCallback] that will be passed
the global `yargs` object which can be used to perform any global operations with Yargs.

### Using a Custom Parser

This callback may optionally return a [`yargs.ParseCallback`][yargs.ParseCallback] that can can be used
to intercept output from Yargs, manipulate it, and write it to an output stream explicitly.

**Example:**

> `cli.ts`

```ts
import cli from '@darkobits/saffron';

// Configure commands for the application.
cli.command({
  // ...
});

cli.command({
  // ...
});

// Then, call init.
cli.init();

// Or:
cli.init(yargs => {
  yargs.wrap(120);

  // Optionally return a ParseCallback.
  return (err, argv, output) => {
    if (err) {
      process.stderr.write(err.message);
      return;
    }

    if (output) {
      process.stdout.write(output);
      return;
    }
  };
});
```

## TypeScript Integration

Saffron supports strongly-typed arguments and configuration schemas. If type definitions exist for
these, they may be passed to Saffron as a type argument and Saffron will ensure that the objects passed
to your builder and handlers are appropriately typed:

```ts
import cli from '@darkobits/saffron';

interface Arguments {
  spline: string;
  algorithm: 'RTA-20' | 'RTA-21' | 'RTA-22';
}

cli.command<Arguments>({
  handler: ({ argv, config }) => {
    // argv is of type Arguments.
  }
});

cli.init();
```

If the schema for your application's arguments and configuration differs, a second type argument may be
provided to distinguish the argument schema from the configuration schema:

```ts
import cli from '@darkobits/saffron';

interface Arguments {
  spline: string;
  algorithm: 'RTA-20' | 'RTA-21' | 'RTA-22';
}

interface Configuration {
  // ...
}

cli.command<Arguments, Configuration>({
  handler: ({ argv, config }) => {
    // argv is of type Arguments.
    // config is of type Configuration if a configuration file was found.
  }
});

cli.init();
```

## Caveats

* If your application has required positional arguments, these **must** be provided via the
  command line and cannot be provided solely from a configuration file. This is a Yargs limitation. To
  circumvent this, all positionals may be defined as optional and validation can be performed in the
  command's handler.

## Addenda

**Why "Saffron"?**

Cosmiconfig is an excellent space-themed configuration loader. Yargs is a fantastic pirate-themed
arguments parser. [Saffron][wiki:saffron-character] is a [space pirate][wiki:space-pirates] in the
excellent [Firefly][wiki:firefly] series.

## See Also

* [Command-Line Interface Guidelines](https://clig.dev) – An open-source guide encouraging best
  practices for authoring CLIs.

[![footer][footer]][footer]

[SaffronBuilder]: src/etc/types.ts#L60-L63
[SaffronBuilderContext]: src/etc/types.ts#L53-L58
[SaffronCommand]: src/etc/types.ts#L139-L204
[SaffronCosmiconfigOptions]: src/etc/types.ts#L103-134
[SaffronHandler]: src/etc/types.ts#L95-L98
[SaffronHandlerContext]: src/etc/types.ts#L68-L92
[SaffronInitCallback]: src/etc/types.ts#L19-L25

[read-pkg.NormalizedPackageJson]: https://github.com/sindresorhus/read-pkg/blob/main/index.d.ts#L24

[cosmiconfig.Options]: https://github.com/davidtheclark/cosmiconfig/blob/main/src/index.ts#L42-L45

[yargs.Arguments]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/yargs/index.d.ts#L663-L670
[yargs.Argv]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/yargs/index.d.ts#L38-L661
[yargs.config]: https://github.com/yargs/yargs/blob/master/docs/api.md#configobject
[yargs.help]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/yargs/index.d.ts#L361-L376
[yargs.ParseCallback]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/yargs/index.d.ts#L654-L660
[yargs.terminalWidth]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/yargs/index.d.ts#L604-L605
[yargs.version]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/yargs/index.d.ts#L640-L652
[yargs.wrap]: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/yargs/index.d.ts#L654-L660

[github:command-module-api]: https://github.com/yargs/yargs/blob/master/docs/api.md#commandmodule
[github:cosmiconfig-search-places]: https://github.com/davidtheclark/cosmiconfig#searchplaces
[github:cosmiconfig-usage]: https://github.com/davidtheclark/cosmiconfig#usage
[github:cosmiconfig]: (https://github.com/davidtheclark/cosmiconfig
[github:package-normalization]: https://github.com/npm/normalize-package-data#what-normalization-currently-entails
[github:yargs-command-aliases]: https://github.com/yargs/yargs/blob/master/docs/advanced.md#command-aliases
[github:yargs-command-description]: (https://github.com/yargs/yargs/blob/master/docs/api.md#usagemessagecommand-desc-builder-handler
[github:yargs-option-options]: https://github.com/yargs/yargs/blob/master/docs/api.md#optionkey-opt
[github:yargs-positional-arguments]: https://github.com/yargs/yargs/blob/master/docs/advanced.md#positional-arguments
[github:yargs-positional-options]: https://github.com/yargs/yargs/blob/master/docs/api.md#positionalkey-opt
[github:yargs]: https://github.com/yargs/yargs

[wiki:firefly]: https://en.wikipedia.org/wiki/Firefly_(TV_series)
[wiki:saffron-character]: https://en.wikipedia.org/wiki/List_of_Firefly_(TV_series)_characters#Saffron
[wiki:space-pirates]: https://en.wikipedia.org/wiki/List_of_space_pirates

[footer]: https://user-images.githubusercontent.com/441546/102322726-5e6d4200-3f34-11eb-89f2-c31624ab7488.png
[hr]: https://user-images.githubusercontent.com/441546/67830932-d6ab4680-fa99-11e9-9870-bc6d31db5a1b.png
