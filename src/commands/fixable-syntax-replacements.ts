import type {SyntaxReplacement} from '../types.js';
import * as webCodemods from '@e18e/web-features-codemods';

export const fixableSyntaxReplacements: SyntaxReplacement[] = [
  {
    name: 'arrayAt',
    codemod: webCodemods['arrayAt']
  },
  {
    name: 'arrayFill',
    codemod: webCodemods['arrayFill']
  },
  {
    name: 'arrayIncludes',
    codemod: webCodemods['arrayIncludes']
  },
  {
    name: 'arrayToReversed',
    codemod: webCodemods['arrayToReversed']
  },
  {
    name: 'arrayToSorted',
    codemod: webCodemods['arrayToSorted']
  },
  {
    name: 'arrayToSpliced',
    codemod: webCodemods['arrayToSpliced']
  },
  {
    name: 'exponentiation',
    codemod: webCodemods['exponentiation']
  },
  {
    name: 'nullishCoalescing',
    codemod: webCodemods['nullishCoalescing']
  },
  {
    name: 'objectHasOwn',
    codemod: webCodemods['objectHasOwn']
  },
  {
    name: 'postcssSignFunctions',
    codemod: webCodemods['postcssSignFunctions']
  },
  {
    name: 'spreadSyntax',
    codemod: webCodemods['spreadSyntax']
  },
  {
    name: 'stringIncludes',
    codemod: webCodemods['stringIncludes']
  },
  {
    name: 'urlCanParse',
    codemod: webCodemods['urlCanParse']
  },
];
