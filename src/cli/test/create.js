const { URL } = require('url')

const chalk = require('chalk')
const ora = require('ora')

const { create, getTestByUuid } = require('../../api/test')
const clientInfo = require('../../utils/client-info')
const headers = require('../../utils/http-headers')
const formatTest = require('../../views/test')

const formatErrorMessage = errors => {
  const error = errors[0]

  if (error.problems && error.problems[0]) {
    return error.problems[0].explanation
  } else {
    return error.message
  }
}

const runIsComplete = runUuid => {
  return new Promise((resolve, reject) => {
    getTestByUuid(runUuid)
      .then(run => (run.status === 'completed' ? resolve(run) : reject(run)))
      .catch(reject)
  })
}

const delay = time => new Promise(resolve => setTimeout(resolve, time))
const waitUntilReady = (runUuid, args) => {
  let spinner
  if (!args.json) {
    spinner = ora('Scheduling test')
    spinner.color = 'magenta'
    spinner.start()
  }

  return new Promise((resolve, reject) => {
    const poll = () => {
      runIsComplete(runUuid)
        .then(res => {
          if (!args.json) spinner.succeed('Testing complete')
          resolve(res)
        })
        .catch(res => {
          if (res.status === 'scheduled' && !args.json)
            spinner.text = 'Waiting to start'
          if (res.status === 'running' && !args.json)
            spinner.text = 'Running test'
          if (res.status === 'timeout' || res.status === 'errored') {
            if (!args.json)
              spinner.fail(chalk.red('An unexpected error occurred'))
            return reject(res)
          }

          if (res.errors) return reject(res.errors)

          delay(5000).then(poll)
        })
    }

    poll()
  })
}

const main = async function(args) {
  let spinner

  if (!args.json) {
    spinner = ora('Connecting to Calibre')
    spinner.color = 'magenta'
    spinner.start()
  }

  try {
    const { uuid } = await create(args)
    if (!args.json) spinner.succeed(`Test created: ${uuid}`)
    const response = await waitUntilReady(uuid, args)

    // Return result
    if (args.json) return console.log(JSON.stringify(response, null, 2))
    console.log(formatTest(response))
  } catch (e) {
    if (args.json) return console.error(e)
    spinner.fail(formatErrorMessage(e))
    process.exit(1)
  }
}

module.exports = {
  command: 'create <url> [options]',
  describe: 'Run a test against any public URL',
  builder: yargs => {
    yargs
      .option('device', {
        describe: 'Sets the emulated device that the test will be run on'
      })
      .option('location', {
        describe: 'The test will be run on a machine in this location'
      })
      .option('connection', {
        describe: 'Sets the emulated connection speed for this test'
      })
      .option('json', {
        describe: 'Return the test result as JSON'
      })
      .demandOption(
        'location',
        'Please provide the location your URL should be tested from'
      )
      .check(({ url, location }) => {
        if (!url.length) return new Error('Please provide a URL')

        try {
          new URL(url)
        } catch (e) {
          return new Error('Please enter a valid URL')
        }

        if (!location) return new Error('Please set --location')

        return true
      })
  },
  handler: main
}
