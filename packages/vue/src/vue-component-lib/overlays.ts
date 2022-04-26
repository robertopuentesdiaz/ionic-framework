import { defineComponent, h, ref, VNode, onMounted } from 'vue';

export interface OverlayProps {
  isOpen?: boolean;
}

const EMPTY_PROP = Symbol();
const DEFAULT_EMPTY_PROP = { default: EMPTY_PROP };

const tagNameToPascalCase = (tagName: string) => {
  return tagName.split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
};

export const defineOverlayContainer = <Props extends object>(tagName: string, defineCustomElement: () => void, componentProps: string[] = [], controller?: any) => {

  const createControllerComponent = () => {
    return defineComponent<Props & OverlayProps>({
      name: tagNameToPascalCase(tagName),
      setup(props: any, { slots, emit }) {
        const eventListeners = [
          { componentEv: `${tagName}-will-present`, frameworkEv: 'willPresent' },
          { componentEv: `${tagName}-did-present`, frameworkEv: 'didPresent' },
          { componentEv: `${tagName}-will-dismiss`, frameworkEv: 'willDismiss' },
          { componentEv: `${tagName}-did-dismiss`, frameworkEv: 'didDismiss' },
        ];

        if (defineCustomElement !== undefined) {
          defineCustomElement();
        }

        const overlay = ref();
        const onVnodeMounted = async () => {
          const isOpen = props.isOpen;
          isOpen && (await present(props))
        }

        const onVnodeUpdated = async (node: VNode, prevNode: VNode) => {
          const isOpen = node.props!.isOpen;
          const prevIsOpen = prevNode.props!.isOpen;

          /**
           * Do not do anything if this prop
           * did not change.
           */
          if (isOpen === prevIsOpen) return;

          if (isOpen) {
            await present(props);
          } else {
            await dismiss();
          }
        }

        const onVnodeBeforeUnmount = async () => {
          await dismiss();
        }

        const dismiss = async () => {
          if (!overlay.value) return;

          await overlay.value;

          overlay.value = overlay.value.dismiss();

          await overlay.value;

          overlay.value = undefined;
        }

        const present = async (props: Readonly<Props>) => {
          /**
           * Do not open another instance
           * if one is already opened.
           */
          if (overlay.value) {
            await overlay.value;
          }

          if (overlay.value?.present) {
            await overlay.value.present();
            return;
          }

          let restOfProps: any = {};

          /**
           * We can use Object.entries here
           * to avoid the hasOwnProperty check,
           * but that would require 2 iterations
           * where as this only requires 1.
           */
          for (const key in props) {
            const value = props[key] as any;
            if (props.hasOwnProperty(key) && value !== EMPTY_PROP) {
              restOfProps[key] = value;
            }
          }

          /**
           * These are getting passed as props.
           * Potentially a Vue bug with Web Components?
           */
          delete restOfProps.onWillPresent;
          delete restOfProps.onDidPresent;
          delete restOfProps.onWillDismiss;
          delete restOfProps.onDidDismiss;

          const component = slots.default && slots.default()[0];
          overlay.value = controller.create({
            ...restOfProps,
            component
          });

          overlay.value = await overlay.value;

          eventListeners.forEach(eventListener => {
            overlay.value.addEventListener(eventListener.componentEv, () => {
              emit(eventListener.frameworkEv);
            });
          })

          await overlay.value.present();
        }

        return () => {
          return h(
            'div',
            {
              style: { display: 'none' },
              onVnodeMounted,
              onVnodeUpdated,
              onVnodeBeforeUnmount,
              isOpen: props.isOpen === true
            }
          );
        }
      }
    });
  };
  const createInlineComponent = () => {
    return defineComponent({
      name: tagNameToPascalCase(tagName),
      setup(props, { slots }) {
        if (defineCustomElement !== undefined) {
          defineCustomElement();
        }
        const isOpen = ref(false);
        const elementRef = ref();

        onMounted(() => {
          elementRef.value.addEventListener('will-present', () => isOpen.value = true);
          elementRef.value.addEventListener('did-dismiss', () => isOpen.value = false);
        });

        return () => {
          let restOfProps: any = {};

          /**
           * We can use Object.entries here
           * to avoid the hasOwnProperty check,
           * but that would require 2 iterations
           * where as this only requires 1.
           */
          for (const key in props) {
            const value = (props as any)[key];
            if (props.hasOwnProperty(key) && value !== EMPTY_PROP) {
              restOfProps[key] = value;
            }
          }

          return h(
            tagName,
            { ...restOfProps, ref: elementRef },
            (isOpen.value) ? slots : undefined
          )
        }
      }
    });
  }

  const Container = (controller !== undefined) ? createControllerComponent() : createInlineComponent();

  Container.displayName = tagName;

  Container.props = {
    'isOpen': DEFAULT_EMPTY_PROP
  };

  componentProps.forEach(componentProp => {
    Container.props[componentProp] = DEFAULT_EMPTY_PROP;
  });

  if (controller !== undefined) {
    Container.emits = ['willPresent', 'didPresent', 'willDismiss', 'didDismiss'];
  }

  return Container;
}
