# Readium Support to Daisy1
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
            daisy*
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
| webpub-manifest element | Daisy 3 file | Daisy 3 element | Value |
| --- | --- | --- | --- |
| @context | package.opf | Constant | https://readium.org/webpub-manifest/context.jsonld |

## Execution Plan
### Phase 1
#### Iteration 1 
1. *Format* : Daisy 3
1. *Type* : Text only files

#### Iteration 2 
Implementation in r2-shared-js
1. *Format* : Daisy 3
1. *Type* : Audio only files

#### Iteration 3 
Implementation in r2-shared-js
1. *Format* : Daisy 3
1. *Type* : Audio and Text files

#### Iteration 4
Integration with Readium

### Phase 2
#### Iteration 5
1. *Format* : Daisy 2
1. *Type* : All Combination

#### Iteration 6
Integration with Readium