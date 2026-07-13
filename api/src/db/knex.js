import knexConfig from '../../db/knexfile.js'
import knexModule from 'knex'

const knex = knexModule(knexConfig)

export default knex

