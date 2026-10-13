import { AuditOptions } from './interfaces/audit-options.interface';

export type KeyIgnoreRules = Required<
  Pick<AuditOptions, 'ignoreKeys' | 'ignorePrefixes'>
>;

export function isIgnoredKey(key: string, rules: KeyIgnoreRules): boolean {
  return (
    rules.ignoreKeys.includes(key) ||
    rules.ignorePrefixes.some((prefix) => key.startsWith(prefix))
  );
}
