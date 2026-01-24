import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ToolbarButtonProvider, ConfigProvider } from 'tabby-core'

import { ButtonBarComponent } from './components/buttonBar.component'
import { ButtonBarService } from './services/buttonBar.service'

@NgModule({
    imports: [CommonModule, FormsModule],
    declarations: [ButtonBarComponent],
    exports: [ButtonBarComponent],
})
export class ButtonBarModule {
    constructor(private buttonBarService: ButtonBarService) {
        // Initialize the button bar on app start
        setTimeout(() => {
            this.buttonBarService.initialize()
        }, 500)
    }

    static forRoot() {
        return {
            ngModule: ButtonBarModule,
            providers: [ButtonBarService],
        }
    }
}

/**
 * Toolbar button provider for toggling the button bar
 */
export class ButtonBarToolbarButtonProvider extends ToolbarButtonProvider {
    constructor(private buttonBarService: ButtonBarService) {
        super()
    }

    provide() {
        return [
            {
                icon: 'fas fa-keyboard',
                title: 'Toggle Button Bar',
                touchBarTitle: 'Button Bar',
                weight: -10,
                click: () => {
                    this.buttonBarService.toggle()
                },
            },
        ]
    }
}

/**
 * Config provider for default plugin settings
 */
export class ButtonBarConfigProvider extends ConfigProvider {
    defaults = {
        pluginConfig: {
            'button-bar': {
                barVisible: true,
                lists: [],
                activeListId: '',
            },
        },
    }
}

export default [
    ButtonBarModule.forRoot(),
    { provide: ToolbarButtonProvider, useClass: ButtonBarToolbarButtonProvider, multi: true },
    { provide: ConfigProvider, useClass: ButtonBarConfigProvider, multi: true },
]

export { ButtonBarComponent } from './components/buttonBar.component'
export { ButtonBarService } from './services/buttonBar.service'
