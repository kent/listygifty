module Billing
  module PlanCatalog
    PRICES = {
      yearly: { amount: 2500, currency: "cad", interval: "year", years: 1 },
      two_year: { amount: 4000, currency: "cad", interval: "year", years: 2 }
    }.freeze
  end
end
