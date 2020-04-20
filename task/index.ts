import fs = require('fs')
import jp = require('jsonpath')
import yaml = require('js-yaml')
import * as task from 'azure-pipelines-task-lib/task'

function parseJsonContent(fileContent: string) {
  try {
    return JSON.parse(fileContent)
  }
  catch (err) {
    task.debug(`File could not be parsed as JSON: ${err.message}`)
    return null
  }
}

function serializeJsonContent(jsonContent: any) {
  return JSON.stringify(jsonContent, null, 2)
}

function parseYamlContent(fileContent: string) {
  try {
    return yaml.safeLoad(fileContent)
  }
  catch (err) {
    task.debug(`File could not be parsed as YAML: ${err.message}`)
    return null
  }
}

function serializeYamlContent(yamlContent: any) {
  return yaml.safeDump(yamlContent)
}

function findNodeParentFromJsonPath(jsonContent: any, jsonPath: jp.PathComponent[]) {
  // Sample path: ['$', 'store', 'book', 0, 'author'] => ignore root, stop one
  // step before the last one in order to get the parent
  let cursor = jsonContent
  for (let i = 1; i < jsonPath.length - 1; i++) {
    cursor = cursor[jsonPath[i]]
  }
  return cursor
}

function substituteVariables(objectContent: any) {
  for (const variable of task.getVariables()) {
    let matchingPaths
    try {
      matchingPaths = jp.paths(objectContent, variable.name, 1)
    } catch (err) {
      task.debug(`Variable ${variable.name} is not a valid JSON path: ${err.message}`)
      continue
    }
    if (matchingPaths.length === 0) {
      task.debug(`No JSON path found matching variable ${variable.name}`)
      continue
    }
    task.debug(`Trying to substitute variable ${variable.name}`)
    const jsonPath = matchingPaths[0]
    const node = findNodeParentFromJsonPath(objectContent, jsonPath)
    const lastFieldName = jsonPath[jsonPath.length - 1]
    const originalValue = node[lastFieldName]
    switch (typeof originalValue) {
      case 'string':
        console.log(`Substituting variable ${variable.name} as string`)
        node[lastFieldName] = variable.value
        break
      case 'number':
        console.log(`Substituting variable ${variable.name} as number`)
        node[lastFieldName] = Number(variable.value)
        break
      case 'boolean':
        console.log(`Substituting variable ${variable.name} as boolean`)
        node[lastFieldName] = variable.value == 'true'
        break
      case 'object':
        console.log(`Substituting variable ${variable.name} as JSON object`)
        try {
          node[lastFieldName] = JSON.parse(variable.value)
        } catch (err) {
          task.debug(`Unable to convert ${variable.name} as a JSON object: ${err.message}`)
        }
        break
    }
  }
}

function run() {
  try {
    const filesInput = task.getInput('files', true) as string
    const filePaths = filesInput
      .split('\n')
      .map(f => f.trim())
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) {
        task.setResult(task.TaskResult.Failed, `File ${filePath} does not exist`)
        return
      }
      console.log(`Substituting variables in ${filePath}`)
      const stringContent = fs.readFileSync(filePath).toString()
      const jsonContent = parseJsonContent(stringContent)
      if (jsonContent) {
        substituteVariables(jsonContent)
        fs.writeFileSync(filePath, serializeJsonContent(jsonContent))
      } else {
        const yamlContent = parseYamlContent(stringContent)
        if (yamlContent && typeof yamlContent === 'object') {
          substituteVariables(yamlContent)
          fs.writeFileSync(filePath, serializeYamlContent(yamlContent))
        } else {
          task.setResult(task.TaskResult.Failed, `File ${filePath} is neither JSON nor YAML`)
          return
        }
      }
    }
  }
  catch (err) {
    task.setResult(task.TaskResult.Failed, err.message)
  }
}

run()
