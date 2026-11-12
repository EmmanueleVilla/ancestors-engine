# ancestors-engine

An engine for genealogical archives kept as YAML files, designed to be worked on together with an LLM agent:

- **strict schemas** (Zod) for persons, families, events, places, sources, citations, and media;
- **provenance on kinship links**: citations and a confidence level on each single parent–child link;
- **reading paradata**: who transcribed a source and whether a person re-read it on the original;
- **research log**, including searches with no result, with a controlled set of outcomes;
- **validator** (references, cycles, impossible dates, missing sources);
- **static site** with a private profile and a public profile that masks living persons, replaces their IDs with pseudonyms, and stops the build if it finds a data leak.

The public site also publishes the dataset as JSON (one file per record type, listed on `dati.html`), with the same masking and leak check. `ancestors export` writes the same files to a folder, for deposit elsewhere as open data.

The data of a real archive live in a separate **private** repository that uses the engine as a dependency.

## Try the example

```sh
npm install
npm run example:check
npm run example:site          # private site in dist-example/
npm run example:site:public   # public site in dist-example-public/
```

The example (`example/`) is an invented family.

## Use the engine in an archive

```json
"dependencies": { "ancestors-engine": "github:EmmanueleVilla/ancestors-engine#v1.2.1" },
"scripts": {
  "check": "ancestors validate --strict",
  "site": "ancestors build --profile private",
  "site:public": "ancestors build --profile public",
  "export": "ancestors export -o export-public"
}
```

The full steps are in [_docs/nuovo-archivio.md](_docs/nuovo-archivio.md). Starter files are in `templates/`.

## Documentation

The documentation, for people and LLM agents, is in [_docs/](_docs/README.md). It is written in Italian, like the interface of the generated site and the example archive.

## License

MIT. See [LICENSE](LICENSE).
