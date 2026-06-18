type FormatUnitOptions = {
  signed?: boolean
  rawDecimals?: number
}

export const formatCompactUnit = (
  num: number,
  units: readonly string[],
  options: FormatUnitOptions = {},
) => {
  const sign = num < 0 ? '-' : options.signed && num > 0 ? '+' : ''
  const value = Math.abs(num)
  let unitIndex = 0
  let scaled = value

  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000
    unitIndex += 1
  }

  const maximumFractionDigits =
    unitIndex === 0
      ? options.rawDecimals ?? (scaled % 1 !== 0 ? 1 : 0)
      : scaled % 1 !== 0
        ? 1
        : 0

  return `${sign}${scaled.toLocaleString('fr-FR', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  })} ${units[unitIndex]}`
}

export const formatEnergy = (wh: number, options?: FormatUnitOptions) =>
  formatCompactUnit(wh, ['Wh', 'kWh', 'MWh', 'GWh'], options)

export const formatEnergyRate = (whPerMinute: number) =>
  `${formatEnergy(whPerMinute)}/min`

export const formatSignedEnergyRate = (whPerMinute: number) =>
  `${formatEnergy(whPerMinute, { signed: true })}/min`
