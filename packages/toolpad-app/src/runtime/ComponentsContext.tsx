import * as React from 'react';
import * as builtIns from '@mui/toolpad-components';
import {
  ToolpadComponent,
  TOOLPAD_COMPONENT,
  createComponent,
  ComponentsContextProvider,
  useComponents,
} from '@mui/toolpad-core';
import * as ReactIs from 'react-is';
import * as appDom from '../appDom';
import { getToolpadComponents } from '../toolpadComponents';
import { ensureToolpadComponent } from './loadCodeComponent';
import { hasOwnProperty } from '../utils/collections';
import { useAppModules } from './AppModulesProvider';

function createToolpadComponentThatThrows(error: Error) {
  return createComponent(() => {
    throw error;
  });
}

function isToolpadComponent(maybeComponent: unknown): maybeComponent is ToolpadComponent<any> {
  if (
    !ReactIs.isValidElementType(maybeComponent) ||
    typeof maybeComponent === 'string' ||
    !hasOwnProperty(maybeComponent, TOOLPAD_COMPONENT)
  ) {
    return false;
  }

  return true;
}

interface ComponentsContextProps {
  catalog?: Record<string, ToolpadComponent>;
  dom: appDom.AppDom;
  children?: React.ReactNode;
}

export default function ComponentsContext({
  catalog: componentsCatalog,
  dom,
  children,
}: ComponentsContextProps) {
  const modules = useAppModules();

  const components = React.useMemo(() => {
    if (componentsCatalog) {
      return componentsCatalog;
    }

    const catalog = getToolpadComponents(dom);
    const result: Record<string, ToolpadComponent<any>> = {};

    for (const [id, componentDef] of Object.entries(catalog)) {
      if (componentDef) {
        if (componentDef.builtIn) {
          const builtIn = (builtIns as any)[componentDef.builtIn];

          if (!isToolpadComponent(builtIn)) {
            result[id] = createToolpadComponentThatThrows(
              new Error(`Imported builtIn "${componentDef.builtIn}" is not a ToolpadComponent`),
            );
          } else {
            result[id] = builtIn;
          }
        }

        if (componentDef?.codeComponentId) {
          const componentId = componentDef.codeComponentId;
          const moduleEntry = modules[`codeComponents/${componentId}`];
          if (moduleEntry) {
            result[id] = moduleEntry.error
              ? createToolpadComponentThatThrows(moduleEntry.error)
              : ensureToolpadComponent((moduleEntry.module as any)?.default);
          }
        }
      }

      if (!result[id]) {
        result[id] = createToolpadComponentThatThrows(
          new Error(`Can't find component for "${id}"`),
        );
      }
    }

    return result;
  }, [componentsCatalog, dom, modules]);

  return <ComponentsContextProvider value={components}>{children}</ComponentsContextProvider>;
}

export { useComponents };

export function useComponent(id: string) {
  const components = useComponents();
  return React.useMemo(() => {
    return (
      components?.[id] ??
      createToolpadComponentThatThrows(new Error(`Can't find component for "${id}"`))
    );
  }, [components, id]);
}
