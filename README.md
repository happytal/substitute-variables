# Substitute Variables task

An Azure DevOps Pipelines task for replacing variables in plain JSON and YAML
files using values from pipeline variables.

Features:

- Guesses type of JSON and YAML files
- Substitutes nested variables
- Preserves types of the substituted variables
- Injects complex objects as values

## Usage

```
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

## Example

Given this initial file

```json
{
  "id": "root",
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

Substitution will result in the following file

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
