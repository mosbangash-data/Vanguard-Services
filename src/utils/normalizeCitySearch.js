'use strict';

const normalizeCitySearch = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .trim()
  .replace(/\s+/g, ' ');

const cityMatchesSearch = (city, query) => {
  const normalizedQuery = normalizeCitySearch(query);
  return !normalizedQuery || normalizeCitySearch(city).includes(normalizedQuery);
};

module.exports = { normalizeCitySearch, cityMatchesSearch };
