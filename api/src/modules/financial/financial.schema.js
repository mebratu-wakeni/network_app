/**
 * Financial schema validation (optional - can use simple validation in controller)
 */
export const createExpenseSchema = {
  body: {
    type: 'object',
    required: ['paid_on', 'category', 'amount'],
    properties: {
      customer_id: { type: 'integer', nullable: true },
      category: { type: 'string' },
      paid_on: { type: 'string', format: 'date' },
      invoice_no: { type: 'string' },
      amount: { type: 'number', minimum: 0.01 },
      description: { type: 'string' },
      payment_method: { type: 'string', enum: ['cash', 'credit', 'cheque', 'bank_transfer'] },
      withhold_percentage: { type: 'number', minimum: 0, maximum: 100 },
      cheque_no: { type: 'string' },
      cheque_date: { type: 'string', format: 'date' },
      bank_name: { type: 'string' },
      bank_transfer_ref: { type: 'string' }
    }
  }
}

export const createDepositSchema = {
  body: {
    type: 'object',
    required: ['deposit_date', 'amount'],
    properties: {
      deposit_date: { type: 'string', format: 'date' },
      type: { type: 'string', enum: ['deposit', 'contribution', 'initial_seed', 'capital_injection', 'other'] },
      amount: { type: 'number', minimum: 0.01 },
      description: { type: 'string' },
      source: { type: 'string' },
      reference_no: { type: 'string' }
    }
  }
}

export const createCashLoanReceivableSchema = {
  body: {
    type: 'object',
    required: ['partner_id', 'amount', 'lent_date'],
    properties: {
      partner_id: { type: 'integer' },
      amount: { type: 'number', minimum: 0.01 },
      lent_date: { type: 'string', format: 'date' },
      expected_return_date: { type: 'string', format: 'date' },
      notes: { type: 'string' },
      reference_no: { type: 'string' }
    }
  }
}

export const createCashLoanPayableSchema = {
  body: {
    type: 'object',
    required: ['partner_id', 'amount', 'borrowed_date'],
    properties: {
      partner_id: { type: 'integer' },
      amount: { type: 'number', minimum: 0.01 },
      borrowed_date: { type: 'string', format: 'date' },
      expected_repay_date: { type: 'string', format: 'date' },
      notes: { type: 'string' },
      reference_no: { type: 'string' }
    }
  }
}
