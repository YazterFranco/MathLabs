import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spokenText } from '../src/ui/speech.ts';

test('voz: operaciones y fracciones se leen en español', () => {
  assert.equal(spokenText('7 × 8 = ?'), '7 por 8 es igual a ?');
  assert.equal(spokenText('24 ÷ 4 = ?'), '24 entre 4 es igual a ?');
  assert.equal(spokenText('3/8 + 2/8 = ?'), '3 octavos más 2 octavos es igual a ?');
  assert.equal(spokenText('1/2 de 12 = ?'), 'un medio de 12 es igual a ?');
  assert.equal(spokenText('1/2 = __/4'), 'un medio es igual a espacio en blanco cuartos');
  assert.equal(spokenText('5 grupos de 5: ¿cuántos hay en total?'), '5 grupos de 5: ¿cuántos hay en total?');
  assert.equal(spokenText('3.45 + 2.5 = ?'), '3 punto 45 más 2 punto 5 es igual a ?');
  assert.equal(spokenText('25% de 80 = ?'), '25 por ciento de 80 es igual a ?');
  assert.equal(spokenText('Un cuadrado tiene lados de 4 cm. ¿Cuál es su área en cm²?'), 'Un cuadrado tiene lados de 4 centímetros . ¿Cuál es su área en centímetros cuadrados ?');
  assert.equal(spokenText('−5 + (−8) = ?'), 'menos 5 más menos 8 es igual a ?');
  assert.equal(spokenText('3² + 4 × 2 = ?'), '3 al cuadrado más 4 por 2 es igual a ?');
  assert.equal(spokenText('4 boletos cuestan $12.'), '4 boletos cuestan 12 dólares.');
});
