import multer from 'multer'

const FIFTY_MB = 50 * 1024 * 1024

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FIFTY_MB },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase()
    if (name.endsWith('.csv')) return cb(null, true)
    cb(new Error('Only .csv files are allowed'))
  }
})

/** Express middleware: multipart field name `file`, max 50MB */
export function uploadCsvFile (req, res, next) {
  csvUpload.single('file')(req, res, (err) => {
    if (err) {
      err.status = 400
      return next(err)
    }
    next()
  })
}
