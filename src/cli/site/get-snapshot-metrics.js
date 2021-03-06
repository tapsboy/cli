const ora = require('ora')
const json2csv = require('json2csv')
const { snapshot } = require('../../api/snapshot-metrics')
const formatSnapshot = require('../../views/snapshot-metrics')

const formatCSV = payload => {
  let data = []

  payload.snapshot.tests.forEach(test => {
    const testProfile = payload.testProfiles.find(
      profile => profile.id === test.testProfile.id
    )

    test.measurements.forEach(measurement => {
      data.push({
        Timestamp: payload.snapshot.createdAt,
        PageName: test.page.name,
        PageURL: test.page.url,
        MetricName: measurement.name,
        MetricLabel: measurement.label,
        MetricValue: measurement.value,
        SnapshotSequenceId: payload.snapshot.sequenceId,
        TestProfileId: testProfile.id,
        TestProfileName: testProfile.name,
        DeviceName: testProfile.device.title,
        BandwidthName: testProfile.bandwidth.title,
        isMobile: testProfile.isMobile,
        hasDeviceEmulation: testProfile.hasDeviceEmulation,
        hasBandwidthEmulation: testProfile.hasBandwidthEmulation
      })
    })
  })

  const fields = [
    'Timestamp',
    'PageName',
    'PageURL',
    'MetricName',
    'MetricLabel',
    'MetricValue',
    'SnapshotSequenceId',
    'TestProfileId',
    'TestProfileName',
    'DeviceName',
    'BandwidthName',
    'isMobile',
    'hasDeviceEmulation',
    'hasBandwidthEmulation'
  ]
  return json2csv({ data, fields })
}

const main = async args => {
  let spinner
  if (!args.json && !args.csv) {
    spinner = ora('Connecting to Calibre')
    spinner.color = 'magenta'
    spinner.start()
  }

  try {
    const payload = await snapshot({
      site: args.site,
      snapshotId: args.snapshot
    })

    if (!payload.snapshot.tests.length) {
      if (args.json)
        return console.error(
          JSON.stringify({ error: 'no data found', args: args }, null, 2)
        )

      if (args.csv)
        return json2csv({ data: ['No data found'], fields: ['Error'] })

      spinner.fail('No data found for this search')
      process.exit(1)
    }

    if (args.json) return console.log(JSON.stringify(payload, null, 2))
    if (args.csv) return console.log(formatCSV(payload))

    spinner.stop()
    console.log(formatSnapshot(payload.snapshot))
  } catch (e) {
    if (args.json) return console.error(e)
    spinner.fail(e.map(err => err.message).join(', '))
    process.exit(1)
  }
}

module.exports = {
  command: 'get-snapshot-metrics [options]',
  describe: 'Get the metrics of a given snapshot',
  builder: yargs => {
    yargs.options({
      site: { demandOption: true, describe: 'The identifying slug of a site' },
      snapshot: {
        demandOption: true,
        describe: 'The identifying id of a snapshot'
      },
      json: { describe: 'Return the snapshot metrics as JSON' },
      csv: { describe: 'Return the snapshot metrics as CSV' }
    })
  },
  handler: main
}
