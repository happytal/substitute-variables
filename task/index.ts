import fs = require('fs')
import jp = require('jsonpath')
import yaml = require('js-yaml')
import decomment = require('decomment')
import * as task from 'azure-pipelines-task-lib/task'

const BOM = '\ufeff'

function parseJsonContent(fileContent: string) {
  try {
    const decommented = decomment(fileContent, { tolerant: true })
    return JSON.parse(decommented)
  }
  catch (err: any) {
    task.debug(`File could not be parsed as JSON: ${err.message}`)
    return null
  }
}

function serializeJsonContent(jsonContent: any, withBom: boolean) {
  return (withBom ? BOM : '') + JSON.stringify(jsonContent, null, 2)
}

function parseYamlContent(fileContent: string) {
  try {
    return yaml.safeLoadAll(fileContent)
  }
  catch (err: any) {
    task.debug(`File could not be parsed as YAML: ${err.message}`)
    return null
  }
}

function serializeYamlContent(yamlContentArray: any, withBom: boolean) {
  return (withBom ? BOM : '') + yamlContentArray.map((yamlContent: any) => yaml.safeDump(yamlContent)).join('---\n');
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
    } catch (err: any) {
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
        } catch (err: any) {
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
      let stringContent = fs.readFileSync(filePath).toString()
      let startsWithBom = false
      if (stringContent.startsWith(BOM)) {
        startsWithBom = true
        stringContent = stringContent.substring(BOM.length)
      }
      const jsonContent = parseJsonContent(stringContent)
      if (jsonContent) {
        substituteVariables(jsonContent)
        fs.writeFileSync(filePath, serializeJsonContent(jsonContent, startsWithBom))
      } else {
        const yamlContentArray = parseYamlContent(stringContent)
        if (yamlContentArray && Array.isArray(yamlContentArray) && yamlContentArray.every(yamlContent => typeof yamlContent === 'object')) {
          for (const yamlContent of yamlContentArray) {
            substituteVariables(yamlContent)
          }
          fs.writeFileSync(filePath, serializeYamlContent(yamlContentArray, startsWithBom))
        } else {
          task.setResult(task.TaskResult.Failed, `File ${filePath} is neither JSON nor YAML`)
          return
        }
      }
    }
  }
  catch (err: any) {
    task.setResult(task.TaskResult.Failed, err.message)
  }
}

run()
