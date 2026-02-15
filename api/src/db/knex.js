import knexConfig from '../../db/knexfile.js'
import knexModule from 'knex'

const knex = knexModule(knexConfig)

// SQLite safety defaults.
knex.raw('PRAGMA foreign_keys = ON').catch(() => {})
knex.raw('PRAGMA journal_mode = WAL').catch(() => {})

export default knex

