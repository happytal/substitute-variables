# Substitute Variables task

An Azure DevOps Pipelines task for replacing variables in plain JSON and YAML
files using values from pipeline variables.

Features:

- Guesses type of JSON and YAML files
- Substitutes nested variables
- Preserves types of the substituted variables
- Injects complex objects as values

## Usage

```yaml
steps:
- task: SubstituteVariables@1
  inputs:
    files: |
      values.yaml
      values.json
```

The task has a single parameter for the list of files. They will be overwritten,
substituting the value of any key matching the name of a pipeline variable with
the value of the variable.

Variable names are interpreted as [JSONPath](https://goessner.net/articles/JsonPath/).
When matching a node, the value of the first match is used. Variables that do not match
are ignored.

## Limitations

Azure DevOps prevents using the equal (`=`) character in variable names. In order
to use this character in a JSONPath, you can URLEncode it.

For example, in this kind of expression:

```
# The actual expression
menu.items[?(@.value=='Open')].onclick

# The variable name in the variable library
menu.items[?(@.value%3D%3D'Open')].onclick
```

## Examples

### Substitute variables from a JSON file

Given this initial `example.json` file

```jsonc
{
  "id": "root",
  // Commented JSON files are supported
  "menu": {
    "value": "File",
    "count": 10,
    "items": [
      { "value": "New", "onclick": "CreateNewDoc()" },
      { "value": "Open", "onclick": "OpenDoc()" },
      { "value": "Close", "onclick": "CloseDoc()" }
    ]
  }
}
```

And this set of values at the time the task is called

```
# A simple variable.
id = newid
# A nested variable.
menu.value = New Value
# An integer. Types are preserved
menu.count = 42
# A nested value in an array.
menu.items[1].value = New item value
# A complex object. It will be parsed an injected as JSON.
menu.items[2] = {"type": "Another object"}
```

Substitution will result in the following `example.json` file

```json
{
  "id": "newid",
  "menu": {
    "value": "New Value",
    "count": 42,
    "items": [
      { "value": "New", "onclick": "CreateNewDoc()" },
      { "value": "New item value", "onclick": "OpenDoc()" },
      { "type": "Another object" }
    ]
  }
}
```

### Substitute variables from a YAML file

Given this initial `example.yaml` file

```yaml
id: root
menu:
  value: File
  count: 10
  items:
  - value: New
    onclick: CreateNewDoc()
  - value: Open
    onclick: OpenDoc()
  - value: Close
    onclick: CloseDoc()
```

And this set of values at the time the task is called

```
# A simple variable.
id = newid
# A nested variable.
menu.value = New Value
# An integer. Types are preserved
menu.count = 42
# A nested value in an array.
menu.items[1].value = New item value
# A complex object. It will be parsed an injected as JSON.
menu.items[2] = {"type": "Another object"}
```

Using the following task

```yaml
steps:
- task: SubstituteVariables@1
  inputs:
    files: example.yaml
```

Substitution will result in the following `example.yaml` file

```yaml
id: newid
menu:
  value: New Value
  count: 42
  items:
  - value: New
    onclick: CreateNewDoc()
  - value: New item value
    onclick: OpenDoc()
  - type: Another object
```
