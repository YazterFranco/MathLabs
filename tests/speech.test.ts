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
});
