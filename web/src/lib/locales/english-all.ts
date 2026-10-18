/**
 * Every lazy English group, registered. For tests and tools that have no route.
 *
 * The app never imports this file: it would put all four groups back into the
 * first load, which is exactly what splitting them out removed. A test that
 * needs the whole English dictionary imports it so `translator('en')` answers
 * for every key.
 */
import './en/workspaceEn';
import './en/weaknessEn';
import './en/grammarEn';
import './en/readerEn';
