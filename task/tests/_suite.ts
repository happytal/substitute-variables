import fs = require('fs')
import path = require('path')
import assert = require('assert')
import tmp = require('tmp')
import yaml = require('js-yaml')
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test'

const SAMPLE_FILE = {
  "id": "root",
  "menu": {
    "id": "file",
    "value": "File",
    "count": 10,
    "enabled": true,
    "items": [
      { "value": "New", "onclick": "CreateNewDoc()" },
      { "value": "Open", "onclick": "OpenDoc()" },
      { "value": "Close", "onclick": "CloseDoc()" }
    ]
  },
  "annotations": {
    "kubernetes.io/ingress.class": "dev"
  }
}

const JSON_WITH_COMMENTS = `
{
  "id": "root",
  // A comment
  "value": "// not a comment"
}
`

const BOM = '\ufeff'

function runTask(variables: Map<string, string>) {
  // Pass variables to tasks in a mocked environment: https://github.com/microsoft/azure-pipelines-task-lib/issues/593
  for (const [key, value] of variables.entries()) {
    const keyAsEnvVariable = key.toUpperCase().replace(/\./g, '_')
    process.env[keyAsEnvVariable] = value
  }
  process.env['VSTS_PUBLIC_VARIABLES'] = JSON.stringify(Array.from(variables.keys()))

  const runner = new MockTestRunner(path.join(__dirname, 'task.js'))
  runner.run()
  return runner
}

describe('Substitute variables task', () => {

  let _tmpFile: tmp.FileResult

  beforeEach(() => {
    _tmpFile = tmp.fileSync()
    process.env.TEST_FILE_PATH = _tmpFile.name
  })

  afterEach(() => {
    _tmpFile.removeCallback()
  })

  it('should replace a simple variable', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))
  
    const runner = runTask(new Map([ ['id', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.id, 'REPLACED')

    done()
  })

  it('should replace a nested variable', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.menu.value, 'REPLACED')

    done()
  })

  it('should replace a number variable', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.count', '42'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.menu.count, 42)

    done()
  })

  it('should replace a boolean variable', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.enabled', 'false'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.menu.enabled, false)

    done()
  })

  it('should replace a variable in an array', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.items[1].value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.menu.items[1].value, 'REPLACED')

    done()
  })

  it('should set a variable to an empty string', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.value', ''] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.menu.value, '')

    done()
  })

  it('should replace an object variable', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.items[1]', '{"value": "REPLACED", "foo": "bar", "n": 42}'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.menu.items[1].value, 'REPLACED')
    assert.strictEqual(content.menu.items[1].foo, 'bar')
    assert.strictEqual(content.menu.items[1].n, 42)
    assert.strictEqual(content.menu.items[1].onclick, undefined)

    done()
  })

  it('should not fail when nothing to replace', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))
  
    const runner = runTask(new Map([ ['doesnotexist', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.id, 'root')

    done()
  })

  it('should write a JSON file as JSON', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = fs.readFileSync(_tmpFile.name).toString()
    assert.strictEqual(content.substring(0, 2), '{\n')

    done()
  })

  it('should write a JSON file with BOM as JSON with BOM', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, BOM + JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = fs.readFileSync(_tmpFile.name).toString()
    assert.strictEqual(content.substring(0, 3), BOM + '{\n')

    done()
  })

  it('should write a YAML file as YAML', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, yaml.safeDump(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = fs.readFileSync(_tmpFile.name).toString()
    assert.strictEqual(content.substring(0, 9), 'id: root\n')

    done()
  })

  it('should write a YAML with BOM file as YAML with BOM', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, BOM + yaml.safeDump(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = fs.readFileSync(_tmpFile.name).toString()
    assert.strictEqual(content.substring(0, 10), BOM + 'id: root\n')

    done()
  })

  it('should fail when file does not exist', (done: MochaDone) => {
    process.env.TEST_FILE_PATH = 'foo'

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, false)
    assert.equal(runner.warningIssues.length, 0)
    assert.deepStrictEqual(runner.errorIssues, ['File foo does not exist'])

    done()
  })

  it('should fail when file type is unknown', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, 'foo')

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, false)
    assert.equal(runner.warningIssues.length, 0)
    assert.deepStrictEqual(runner.errorIssues, [`File ${_tmpFile.name} is neither JSON nor YAML`])

    done()
  })

  it('should not fail when variable cannot be parsed', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, yaml.safeDump(SAMPLE_FILE))

    const runner = runTask(new Map([ ['METADATA_26b0cd9d-186c-4db3-a1d6-7ae4', 'foo'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    done()
  })

  it('should replace variables in multi document YAML files', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, yaml.safeDump(SAMPLE_FILE))
    fs.appendFileSync(_tmpFile.name, '---\n')
    fs.appendFileSync(_tmpFile.name, yaml.safeDump(SAMPLE_FILE))

    const runner = runTask(new Map([ ['menu.value', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)
    
    const content = yaml.safeLoadAll(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content[0].menu.value, 'REPLACED')
    assert.strictEqual(content[1].menu.value, 'REPLACED')

    done()
  })

  it('should replace a variable containing a slash', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON.stringify(SAMPLE_FILE))

    const runner = runTask(new Map([ ['annotations[\'kubernetes.io/ingress.class\']', 'prod'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.annotations['kubernetes.io/ingress.class'], 'prod')

    done()
  })

  it('should strip comments from JSON files', (done: MochaDone) => {
    fs.writeFileSync(_tmpFile.name, JSON_WITH_COMMENTS)
  
    const runner = runTask(new Map([ ['id', 'REPLACED'] ]))

    assert.equal(runner.succeeded, true)
    assert.equal(runner.warningIssues.length, 0)
    assert.equal(runner.errorIssues.length, 0)

    const content = JSON.parse(fs.readFileSync(_tmpFile.name).toString())
    assert.strictEqual(content.id, 'REPLACED')
    assert.strictEqual(content.value, '// not a comment')

    done()
  })

})
