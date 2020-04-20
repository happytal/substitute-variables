import path = require('path')
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run'

const runner = new TaskMockRunner(path.join(__dirname, '..', 'index.js'))
runner.setInput('files', process.env.TEST_FILE_PATH as string)
runner.run()
