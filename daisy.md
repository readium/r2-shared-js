# Readium Support to Daisy
## Reference Schemas
1. Readium Web Publication Manifest
    * _Description_ https://readium.org/webpub-manifest/
    * _Structure_ https://github.com/readium/webpub-manifest/blob/master/schema/publication.schema.json
1. Daisy 3
    * _Description_ - https://daisy.org/activities/standards/daisy/daisy-3/
    * _Structure_ - https://github.com/oxygenxml/Daisy/blob/master/daisy/schemas/dtd/dtbook-2005-3.dtd
1. Daisy 2
    * _Description_ - https://daisy.org/activities/standards/daisy/daisy-2/
    * _Structure_ - https://github.com/oxygenxml/Daisy/blob/master/daisy/schemas/dtd/dtbook-2005-2.dtd

## Code files for Daisy
\* New File
\*\* New Folder
```
- r2-shared-js
    |
    other files & folders ...
    |
    src
        |
        _utils_
        |
        models
        |
        parser
            |
            comicrack
            |
            daisy**
            |
            epub
            |
            cbz.ts
            |
            daisy.ts*
            |
            epub.ts
```
## Mapping
### Webpub Manifest to Daisy 3
#### Link Element
| **webpub-manifest element** | **Daisy file** | **element** | **Notes** |
| --- | --- | --- | --- |
| type | | |  |
| href | | |  |
| duration | | |  |
| rel | | |  |
| height | | |  |
| width | | |  |
| *properties* | | | Object |
| properties.media-overlay | | |  |
| *properties.encrypted* | | | Object |
| properties.encrypted.scheme | | |  |
| properties.encrypted.profile | | |  |
| properties.encrypted.algorithm | | |  |
| properties.encrypted.compression | | |  |
| properties.encrypted.originalLength | | |  |

#### Mapping Table
| **webpub-manifest element** | **Daisy file** | **element** | **Notes** |
| --- | --- | --- | --- |
| @context | package.opf |  |  Value remain constant - https://readium.org/webpub-manifest/context.jsonld |
| *metadata* | | | |
| metadata.@type | | |  |
| metadata.title | | |  |
| metadata.subtitle | | |  |
| metadata.identifier | | |  |
| *metadata.author* | | | Can be 1. single text element 2. object 3. list of objects |
| metadata.author.name | | |  |
| metadata.author.sortAs | | |  |
| *metadata.contributor* | | | Object |
| metadata.contributor.name | | |  |
| metadata.contributor.role | | |  |
| metadata.narrator | | |  |
| metadata.language | | |  |
| metadata.modified | | |  |
| metadata.published | | |  |
| metadata.description | | |  |
| metadata.rights | | |  |
| metadata.source | | |  |
| metadata.subject | | | List of String |
| metadata.duration | | |  |
| *metadata.media-overlay* | | | Object |
| metadata.media-overlay.active-class | | |  |
| *links* | | | List of links |
| *readingOrder* | | | List of links |
| *resources* | | | List of links |

## Execution Plan
### Phase 1 (Daisy 3)

> Implementation in r2-shared-js

#### Iteration 1
1. *Format* : Daisy 3
1. *Type* : Text only files

#### Iteration 2
1. *Format* : Daisy 3
1. *Type* : Audio only files

#### Iteration 3
1. *Format* : Daisy 3
1. *Type* : Audio and Text files

#### Iteration 4
> Implementation in Readium

Readium Integration

### Phase 2 (Daisy 2)
#### Iteration 5
1. *Format* : Daisy 2
1. *Type* : All Combination
1. Readium Integration
