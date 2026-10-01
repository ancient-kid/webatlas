import readabilitySource from '@mozilla/readability/Readability.js?raw'
import { readabilityScript } from './webviewScripts'

/** Article-text extraction script with the bundled Readability source inlined. */
export const READABILITY_SCRIPT = readabilityScript(readabilitySource)
