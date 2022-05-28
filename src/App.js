import React from 'react'

import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'

import Header from './components/Header'
import Home from './components/Home'
import FileList from './components/FileList'
import Output from './components/Output'
import Buttons from './components/Buttons'
import Settings from './components/Settings'
import Footer from './components/Footer'

import { setCookie, getCookie } from './modules/cookie.js'

const loadSettings = () => {
  let settings = {
    baudRate: 115200,
  }

  const cookieValue = getCookie('settings')

  try {
    const cookieJSON = JSON.parse(cookieValue)

    if ('baudRate' in cookieJSON) settings.baudRate = cookieJSON.baudRate
  } catch (e) {
    console.error(e)
  }

  //saveSettings(settings)
  return settings
}

const formatMacAddr = (macAddr) => {
  return macAddr.map((value) => value.toString(16).toUpperCase().padStart(2, '0')).join(':')
}

function App() {
  // Connection status
  const [connected, setConnected] = React.useState(false)

  // Serial output
  const [output, setOutput] = React.useState('')

  // ESP flasher stuff
  const [espStub, setEspStub] = React.useState(undefined)

  // Uploaded Files
  const [uploads, setUploads] = React.useState([])

  // Settings Window
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  // Settings
  const [settings, setSettings] = React.useState(loadSettings())

  const saveSettings = (newSettings) => {
    setSettings({
      baudRate: newSettings.baudRate
    })

    setCookie('settings', JSON.stringify(newSettings), 365)
  }

  const clickConnect = async () => {
    if (espStub) {
      await espStub.disconnect()
      await espStub.port.close()
      setEspStub(undefined)
      return
    }

    const esploaderMod = await window.esptoolPackage

    const esploader = await esploaderMod.connect({
      log: (...args) => {
        //console.log(...args)
        console.log(args[0])
        setOutput(`${args[0]}\n`)
      },
      debug: (...args) => console.debug(...args),
      error: (...args) => console.error(...args),
      baudRate: settings.baudRate,
    })

    try {
      toast.info("Connecting...", { autoClose: false, toastId: 'connecting' })

      await esploader.initialize()

      setOutput(`Connected to ${esploader.chipName}\n`)
      setOutput(`MAC Address: ${formatMacAddr(esploader.macAddr())}\n`)

      const newEspStub = await esploader.runStub()

      setConnected(true)
      toast.update('connecting', {
        render: 'Connected 🚀',
        type: toast.TYPE.SUCCESS,
        autoClose: 3000
      })

      console.log(newEspStub)

      newEspStub.port.addEventListener('disconnect', () => {
        setConnected(false)
        setEspStub(undefined)
        toast.warning('Disconnected 💔', { autoClose: 3000, toastId: 'settings' })
        setOutput(`------------------------------------------------------------\n`)
      })

      setEspStub(newEspStub)
    } catch (err) {
      toast.update('connecting', {
        render: 'Encountered error 🙁',
        type: toast.TYPE.ERROR,
        autoClose: 3000
      })

      await esploader.disconnect()
      throw err
    }
  }

  const clickErase = async () => {
    if (
      window.confirm('This will erase the entire flash. Click OK to continue.')
    ) {
      //baudRate.disabled = true;
      //butErase.disabled = true;
      //butProgram.disabled = true;
      try {
        console.log('Erasing flash memory. Please wait...');
        let stamp = Date.now();
        await espStub.eraseFlash();
        console.log('Finished. Took ' + (Date.now() - stamp) + 'ms to erase.');
      } catch (e) {
        console.error(e);
      } finally {
        //butErase.disabled = false;
        //baudRate.disabled = false;
        //butProgram.disabled = getValidFiles().length == 0;
      }
    }

  }

  const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  const clickProgram = async () => {
    const toArrayBuffer = (inputFile) => {
      const reader = new FileReader()

      return new Promise((resolve, reject) => {
        reader.onerror = () => {
          reader.abort();
          reject(new DOMException("Problem parsing input file."));
        }

        reader.onload = () => {
          resolve(reader.result);
        }
        reader.readAsArrayBuffer(inputFile)
      })
    }

    for (const file of uploads) {
      try {
        const contents = await toArrayBuffer(file.obj)
        console.log(file)
        console.log(contents)

        /*await*/ espStub.flashData(
          contents,
          (bytesWritten, totalBytes) => {
            console.log(
              Math.floor((bytesWritten / totalBytes) * 100) + "%"
            )
          },
          0,//parseInt(file.offset, 16)
        ).then(() => sleep(100)).then(() => console.log('done'))

        //await sleep(100)
      } catch (e) {
        console.error(e)
      }
    }

    //console.log('=> To run the new firmware, please reset your device.');
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header sx={{ mb: '1rem' }} />

      <Grid container direction='column' alignItems='center' spacing={1}>

        {/* Home & FileUpload Page */}
        <Grid item xs={12}>
          {connected ?
            <FileList
              uploads={uploads}
              setUploads={setUploads}
            />
            :
            <Home
              connect={clickConnect}
              supported={() => true}
              openSettings={() => setSettingsOpen(true)}
            />
          }
        </Grid>

        {/* Serial Output */}
        <Grid item xs={12}>
          <Output
            received={output}
          />
        </Grid>

        {/* Erase & Program Buttons */}
        {connected &&
          <Grid item xs={12} sx={{ my: '1rem' }}>
            <Buttons
              erase={() => clickErase()}
              program={() => clickProgram()}
              disabled={uploads.length === 0}
            />
          </Grid>
        }
      </Grid>

      {/* Settings Window */}
      <Settings
        open={settingsOpen}
        close={() => setSettingsOpen(false)}
        save={saveSettings}
        settings={settings}
        openPort={connected}
        saveToast={() => toast.success('Settings saved ✨', { autoClose: 3000, toastId: 'settings' })}
      />

      {/* Toaster */}
      <ToastContainer />

      {/* Footer */}
      <Footer sx={{ mt: 'auto' }} />
    </Box>
  )
}

export default App