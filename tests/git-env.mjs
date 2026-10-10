/**
 * An environment in which `git` cannot find a repository it was not pointed at.
 *
 * Two tests here build a throwaway repository in a temp directory, plant a
 * commit message in it and assert a script's verdict. Both passed `cwd: dir`
 * and both looked hermetic. Neither was.
 *
 * `git` sets `GIT_DIR` for a hook, and `GIT_DIR` beats the working directory.
 * In the main checkout the value git exports is the RELATIVE string `.git`, so
 * a `git init` run with `cwd` set to `/var/folders/.../attrib-XXXX` resolves it
 * to `/var/folders/.../attrib-XXXX/.git` — the throwaway repository the test
 * meant to create. The isolation was real, and it was an accident of one
 * environment.
 *
 * In a git WORKTREE the exported value is absolute. The same `git init` then
 * re-initialises the real repository, `git config user.email` writes the
 * fixture identity into the shared config, and `git commit` lands the fixture
 * commits on whatever branch is checked out. Observed on 2026-10-10 on a push
 * from a worktree: two fixture commits on the live branch, `core.bare` set to
 * true, and `user.email` set to `author@example.invalid` in the config every
 * worktree of this repository shares — so the next commit anybody made here
 * would have carried the wrong author. The pre-push attribution scan then
 * refused the push, which is the one thing that went right: it reads
 * `git log --all`, so it saw the planted trailer and stopped it reaching a
 * public repository.
 *
 * This is docs/lessons.md #10 in a new costume. The belief was *a child
 * process inherits a directory, not a repository*, nobody declared it, and it
 * held for as long as nobody ran the suite from a worktree.
 *
 * So the fix is not "unset GIT_DIR". Every variable in git's environment block
 * can redirect a git command — `GIT_WORK_TREE`, `GIT_INDEX_FILE`,
 * `GIT_OBJECT_DIRECTORY`, `GIT_COMMON_DIR`, `GIT_CONFIG_GLOBAL`,
 * `GIT_ALTERNATE_OBJECT_DIRECTORIES` — and naming the ones that bit us is how
 * the next one gets through. Every `GIT_*` variable goes, and a test may add
 * back exactly what it means to set.
 */

/**
 * `process.env` with every `GIT_*` variable removed.
 *
 * @param {Record<string, string>} [extra] variables to set deliberately.
 * @returns {Record<string, string>} an env block safe to hand to a git child.
 */
export function gitFreeEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('GIT_')) continue;
    if (v !== undefined) env[k] = v;
  }
  return { ...env, ...extra };
}

/**
 * The names this helper strips, so a test can assert on the list rather than
 * trusting the prose above. `GIT_DIR` first because it is the one that bit.
 */
export const REDIRECTING_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_NAMESPACE',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_COUNT',
  'GIT_PREFIX',
  'GIT_CEILING_DIRECTORIES',
];
