import invariant from 'invariant';
import {
  getQuickJS,
  QuickJSHandle,
  QuickJSContext,
  RuntimeOptions,
  QuickJSRuntime,
} from 'quickjs-emscripten';
import * as React from 'react';
import { BindingEvaluationResult, JsRuntime, Serializable } from './types.js';
import { errorFrom } from './utils/errors.js';

const JsRuntimeContext = React.createContext<QuickJSRuntime | null>(null);

export interface JsRuntimeProviderProps {
  options?: RuntimeOptions;
  children?: React.ReactNode;
}

export const JsRuntimeProvider = React.lazy(async () => {
  const quickJs = await getQuickJS();
  function Context(props: JsRuntimeProviderProps) {
    const [runtime, setRuntime] = React.useState(() => quickJs.newRuntime(props.options));

    // Make sure to dispose of runtime when it changes or unmounts
    React.useEffect(() => {
      return () => {
        if (runtime.alive) {
          runtime.dispose();
        }
      };
    }, [runtime]);

    React.useEffect(() => setRuntime(quickJs.newRuntime(props.options)), [props.options]);

    return <JsRuntimeContext.Provider value={runtime} {...props} />;
  }
  Context.displayName = 'JsRuntimeProvider';
  return { default: Context };
});

function useQuickJsRuntime(): QuickJSRuntime {
  const runtime = React.useContext(JsRuntimeContext);

  if (!runtime) {
    throw new Error(`No JsRuntime context found`);
  }

  return runtime;
}

function newSerializable(ctx: QuickJSContext, json: unknown): QuickJSHandle {
  switch (typeof json) {
    case 'string':
      return ctx.newString(json);
    case 'number':
      return ctx.newNumber(json);
    case 'boolean':
      return json ? ctx.true : ctx.false;
    case 'object': {
      if (!json) {
        return ctx.null;
      }
      if (Array.isArray(json)) {
        const result = ctx.newArray();
        Object.values(json).forEach((value, i) => {
          const valueHandle = newSerializable(ctx, value);
          ctx.setProp(result, i, valueHandle);
          valueHandle.dispose();
        });
        return result;
      }
      const result = ctx.newObject();
      Object.entries(json).forEach(([key, value]) => {
        const valueHandle = newSerializable(ctx, value);
        ctx.setProp(result, key, valueHandle);
        valueHandle.dispose();
      });
      return result;
    }
    case 'function': {
      const result = ctx.newFunction('anonymous', (...args) => {
        const dumpedArgs: Serializable[] = args.map((arg) => ctx.dump(arg));
        const fnResult = json(...dumpedArgs);
        return newSerializable(ctx, fnResult);
      });
      return result;
    }
    case 'undefined':
      return ctx.undefined;
    default:
      return invariant(false, `invalid value: ${json}`);
  }
}

function evalExpressionInContext(
  ctx: QuickJSContext,
  expression: string,
  globalScope: Record<string, unknown> = {},
): BindingEvaluationResult {
  try {
    Object.entries(globalScope).forEach(([key, value]) => {
      const valueHandle = newSerializable(ctx, value);
      ctx.setProp(ctx.global, key, valueHandle);
      valueHandle.dispose();
    });

    const result = ctx.unwrapResult(ctx.evalCode(expression));
    const resultValue = ctx.dump(result);
    result.dispose();
    return { value: resultValue };
  } catch (rawError) {
    return { error: errorFrom(rawError) };
  }
}

export async function createServerJsRuntime(): Promise<JsRuntime> {
  const quickJs = await getQuickJS();
  const ctx = quickJs.newContext();
  return {
    evaluateExpression: (code, globalScope) => evalExpressionInContext(ctx, code, globalScope),
  };
}

export function useServerJsRuntime(): JsRuntime {
  const quickJs = useQuickJsRuntime();
  const ctx = quickJs.newContext();
  return React.useMemo(
    () => ({
      evaluateExpression: (code, globalScope) => evalExpressionInContext(ctx, code, globalScope),
    }),
    [ctx],
  );
}
