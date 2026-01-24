import { Injectable, ComponentRef, Injector, ApplicationRef, createComponent, EnvironmentInjector } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { ButtonBarComponent } from '../components/buttonBar.component'

@Injectable({ providedIn: 'root' })
export class ButtonBarService {
    private buttonBarRef: ComponentRef<ButtonBarComponent> | null = null
    private wrapperElement: HTMLElement | null = null
    private visible = false

    constructor(
        private injector: Injector,
        private appRef: ApplicationRef,
        private config: ConfigService,
    ) {}

    get isVisible(): boolean {
        return this.visible
    }

    initialize(): void {
        // Load saved visibility state
        const pluginConfig = this.config.store.pluginConfig?.['button-bar'] || {}
        const savedVisible = pluginConfig.barVisible !== false // Default to true

        if (savedVisible) {
            this.show()
        }
    }

    toggle(): void {
        if (this.visible) {
            this.hide()
        } else {
            this.show()
        }
    }

    show(): void {
        if (this.visible && this.wrapperElement) {
            return
        }

        this.createButtonBar()
        this.visible = true
        this.saveVisibility()
    }

    hide(): void {
        if (!this.visible) {
            return
        }

        this.destroyButtonBar()
        this.visible = false
        this.saveVisibility()
    }

    private createButtonBar(): void {
        // Create wrapper element
        this.wrapperElement = document.createElement('div')
        this.wrapperElement.id = 'button-bar-wrapper'
        this.wrapperElement.style.cssText = `
            position: fixed;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
            width: 100%;
        `

        const parent = document.body || document.documentElement
        parent.appendChild(this.wrapperElement)

        // Create the Angular component
        const environmentInjector = this.injector.get(EnvironmentInjector)
        this.buttonBarRef = createComponent(ButtonBarComponent, {
            environmentInjector,
            elementInjector: this.injector,
            hostElement: this.wrapperElement,
        })

        // Inject service reference into component
        this.buttonBarRef.instance.barService = this

        // Attach to Angular change detection
        this.appRef.attachView(this.buttonBarRef.hostView)

    }

    private destroyButtonBar(): void {
        if (this.buttonBarRef) {
            this.appRef.detachView(this.buttonBarRef.hostView)
            this.buttonBarRef.destroy()
            this.buttonBarRef = null
        }

        if (this.wrapperElement && this.wrapperElement.parentNode) {
            this.wrapperElement.parentNode.removeChild(this.wrapperElement)
            this.wrapperElement = null
        }
    }

    private saveVisibility(): void {
        const pluginConfig = this.config.store.pluginConfig || {}
        if (!pluginConfig['button-bar']) {
            pluginConfig['button-bar'] = {}
        }
        pluginConfig['button-bar'].barVisible = this.visible
        this.config.store.pluginConfig = pluginConfig
        this.config.save()
    }
}
