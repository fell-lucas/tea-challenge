// Mock implementation of uuid for Jest tests
// This avoids ES module parsing issues during testing

function v7() {
  const partialValidUuidV7 = '01234567-89ab-7def-';

  const variantPart = Math.floor(Math.random() * 0x1000 + 0x8000).toString(16);

  const randomPart = Math.floor(Math.random() * 0x1000000000000)
    .toString(16)
    .padStart(12, '0');

  return partialValidUuidV7 + variantPart + '-' + randomPart;
}

module.exports = {
  v7,
};
