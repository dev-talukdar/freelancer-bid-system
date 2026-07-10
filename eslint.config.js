import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
export default tseslint.config({ignores:['**/dist/**','**/coverage/**','node_modules/**']},js.configs.recommended,...tseslint.configs.recommendedTypeChecked,{languageOptions:{parserOptions:{projectService:true,tsconfigRootDir:import.meta.dirname},globals:{...globals.node,...globals.browser,chrome:'readonly'}},plugins:{'react-hooks':reactHooks},rules:{'@typescript-eslint/no-explicit-any':'error','@typescript-eslint/consistent-type-imports':'error','@typescript-eslint/no-floating-promises':'error'}},prettier);
