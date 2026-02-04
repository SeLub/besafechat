import * as crypto from 'crypto';

// Функция генерации handle из публичного ключа (как в сервисе)
function generateHandleFromPublicKey(publicKeyBase64: string): string {
  // Декодируем base64 публичный ключ в байты
  const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');

  // Создаем хэш из публичного ключа
  const hash = crypto.createHash('sha256').update(publicKeyBuffer).digest('hex');

  // Берем первые 12 символов хэша для краткости
  const hashPrefix = hash.substring(0, 12);

  // Формируем handle в формате user_{hash}
  return `user_${hashPrefix}`;
}

// Тестовые данные
const testPublicKey = 'wHvpDAkQ589Wu7vbXp7y0mXkvX6cXa5EumE9x+r5R+Y=';
console.log('Тест генерации handle из публичного ключа:');
console.log('Публичный ключ:', testPublicKey);
console.log('Сгенерированный handle:', generateHandleFromPublicKey(testPublicKey));

// Проверим, что функция консистентно генерирует одинаковый handle для одного и того же ключа
const generatedHandle1 = generateHandleFromPublicKey(testPublicKey);
const generatedHandle2 = generateHandleFromPublicKey(testPublicKey);

console.log('\nПроверка консистентности:');
console.log('Первый вызов:', generatedHandle1);
console.log('Второй вызов:', generatedHandle2);
console.log('Результаты совпадают:', generatedHandle1 === generatedHandle2);

// Протестируем несколько разных ключей
const otherKeys = [
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'BBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  'CCCCCCCCCCCCCCCCCCCCCCCCCCC=',
];

console.log('\nТест нескольких разных ключей:');
otherKeys.forEach((key, index) => {
  console.log(`Ключ ${index + 1}: ${key} -> handle: ${generateHandleFromPublicKey(key)}`);
});
