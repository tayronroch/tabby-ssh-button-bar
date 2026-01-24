import { Component, OnInit, OnDestroy, HostBinding, HostListener, ElementRef, ViewChild } from '@angular/core'
import {
    AppService,
    BaseComponent,
    BaseTabComponent,
    ConfigService,
    HostAppService,
    Platform,
    PlatformService,
    SplitTabComponent,
} from 'tabby-core'
import { BaseTerminalTabComponent } from 'tabby-terminal'
import path from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'

export interface ButtonCommand {
    id: string
    label: string
    command: string
    color?: string
    icon?: string
    tooltip?: string
    sendEnter?: boolean
}

export interface ButtonList {
    id: string
    name: string
    buttons: ButtonCommand[]
}

interface ButtonBarStorage {
    lists: ButtonList[]
    activeListId?: string
}

@Component({
    selector: 'button-bar',
    template: `
        <div class="button-bar-container">
            <div class="button-bar-main">
                <div class="list-selector">
                    <button class="list-toggle" #listToggleButton (click)="toggleListMenu($event)">
                        <span>{{ activeList?.name || 'Lists' }}</span>
                        <i class="fas fa-caret-down"></i>
                    </button>
                    <div class="list-menu" #listMenu *ngIf="listMenuVisible" [ngStyle]="listMenuStyles">
                        <div class="list-menu-header">
                            <span>Lists</span>
                            <button class="btn-link btn-sm" (click)="createList($event)" title="New list">+</button>
                        </div>
                        <ng-container *ngFor="let list of lists; let i = index">
                            <div class="list-menu-item" [class.active]="list.id === activeListId">
                                <button class="list-item-name" (click)="setActiveList(list.id)">
                                    {{ list.name }}
                                </button>
                                <div class="list-item-actions">
                                    <button title="Rename" (click)="renameList($event, list)">✎</button>
                                    <button title="Duplicate" (click)="duplicateList($event, list)">⧉</button>
                                    <button title="Delete" (click)="deleteList($event, list)" [disabled]="lists.length === 1">🗑</button>
                                </div>
                            </div>
                        </ng-container>
                        <div class="list-menu-footer">
                            <button class="btn-link btn-sm" (click)="openImportExportModal($event)">
                                <i class="fas fa-cog"></i> Import/Export
                            </button>
                        </div>
                    </div>
                </div>
                <div class="button-bar-buttons">
                    <ng-container *ngIf="activeList">
                        <button *ngFor="let btn of activeList.buttons"
                                class="cmd-btn"
                                tabindex="-1"
                                [style.--btn-color]="btn.color || '#4a4a4a'"
                                [title]="btn.tooltip || btn.command"
                                (click)="executeCommand(btn, $event)"
                                (mousedown)="$event.preventDefault()"
                                (mouseup)="$event.preventDefault()"
                                (contextmenu)="onButtonContextMenu($event, btn)">
                            <i *ngIf="btn.icon" class="fas" [ngClass]="'fa-' + btn.icon"></i>
                            <span>{{ btn.label }}</span>
                        </button>
                    </ng-container>
                    <button class="cmd-btn cmd-btn-add" (click)="openAddModal()" title="Add command">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="button-bar-actions">
                    <button class="action-btn" (click)="toggleCollapse()" title="Hide button bar">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Add/Edit Command Modal -->
        <div class="modal-backdrop" *ngIf="modalVisible" (click)="closeModal()"></div>
        <div class="command-modal" *ngIf="modalVisible">
            <div class="modal-header">
                <h5>{{ editingButton ? 'Edit Command' : 'Add Command' }}</h5>
                <button class="btn btn-link" (click)="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group mb-3">
                    <label class="form-label">Label</label>
                    <input type="text" class="form-control" [(ngModel)]="modalData.label" placeholder="e.g., List Files">
                </div>
                <div class="form-group mb-3">
                    <label class="form-label">Command</label>
                    <input type="text" class="form-control" [(ngModel)]="modalData.command" placeholder="e.g., ls -la">
                </div>
                <div class="form-group mb-3">
                    <label class="form-label">Icon (FontAwesome name, optional)</label>
                    <input type="text" class="form-control" [(ngModel)]="modalData.icon" placeholder="e.g., folder, server, code">
                </div>
                <div class="form-group mb-3">
                    <label class="form-label">Color (optional)</label>
                    <div class="color-picker">
                        <button *ngFor="let color of presetColors"
                                class="color-option"
                                [style.background]="color"
                                [class.selected]="modalData.color === color"
                                (click)="modalData.color = color">
                        </button>
                        <input type="color" [(ngModel)]="modalData.color" class="color-input">
                    </div>
                </div>
                <div class="form-group mb-3">
                    <label class="form-label">Tooltip (optional)</label>
                    <input type="text" class="form-control" [(ngModel)]="modalData.tooltip" placeholder="Description shown on hover">
                </div>
                <div class="form-check mb-3">
                    <input type="checkbox" class="form-check-input" id="sendEnter" [(ngModel)]="modalData.sendEnter">
                    <label class="form-check-label" for="sendEnter">Send Enter after command</label>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
                <button class="btn btn-primary" (click)="saveButton()" [disabled]="!modalData.label || !modalData.command">
                    {{ editingButton ? 'Save' : 'Add' }}
                </button>
            </div>
        </div>

        <!-- Context Menu -->
        <div class="context-menu"
             *ngIf="contextMenuVisible"
             [style.left.px]="contextMenuPosition.x"
             [style.top.px]="contextMenuPosition.y">
            <div class="context-menu-item" (click)="contextMenuEdit()">
                <i class="fas fa-fw fa-edit"></i>
                <span>Edit</span>
            </div>
            <div class="context-menu-item" (click)="contextMenuDuplicate()">
                <i class="fas fa-fw fa-copy"></i>
                <span>Duplicate</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item context-menu-item-danger" (click)="contextMenuDelete()">
                <i class="fas fa-fw fa-trash-alt"></i>
                <span>Delete</span>
            </div>
        </div>

        <!-- Import/Export Modal -->
        <div class="modal-backdrop" *ngIf="importExportModalVisible" (click)="closeImportExportModal()"></div>
        <div class="command-modal" *ngIf="importExportModalVisible">
            <div class="modal-header">
                <h5>Import / Export Lists</h5>
                <button class="btn btn-link" (click)="closeImportExportModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <textarea class="form-control" rows="10" [(ngModel)]="listsJson" placeholder="Paste JSON here to import, or click Export"></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" (click)="exportLists()">Export</button>
                <button class="btn btn-primary" (click)="importLists()">Import</button>
            </div>
        </div>

        <!-- List Name Modal (Create/Rename) -->
        <div class="modal-backdrop" *ngIf="listNameModalVisible" (click)="closeListNameModal()"></div>
        <div class="command-modal" *ngIf="listNameModalVisible">
            <div class="modal-header">
                <h5>{{ editingList ? 'Rename List' : 'New List' }}</h5>
                <button class="btn btn-link" (click)="closeListNameModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">List Name</label>
                    <input type="text" class="form-control" [(ngModel)]="listNameInput" placeholder="e.g., Cisco, Huawei" (keyup.enter)="saveListName()">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" (click)="closeListNameModal()">Cancel</button>
                <button class="btn btn-primary" (click)="saveListName()" [disabled]="!listNameInput?.trim()">
                    {{ editingList ? 'Save' : 'Create' }}
                </button>
            </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div class="modal-backdrop" *ngIf="deleteConfirmVisible" (click)="closeDeleteConfirm()"></div>
        <div class="command-modal" *ngIf="deleteConfirmVisible">
            <div class="modal-header">
                <h5>Delete List</h5>
                <button class="btn btn-link" (click)="closeDeleteConfirm()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to delete "<strong>{{ listToDelete?.name }}</strong>"?</p>
                <p class="text-muted">This will remove all commands in this list.</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" (click)="closeDeleteConfirm()">Cancel</button>
                <button class="btn btn-danger" (click)="confirmDeleteList()">Delete</button>
            </div>
        </div>
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
            pointer-events: auto;
        }

        .button-bar-container {
            width: 100%;
            background: var(--bs-tertiary-bg, #232323);
            border-top: 1px solid var(--bs-border-color, #404040);
            padding: 4px 6px;
            display: flex;
            justify-content: center;
        }

        :host.platform-mac .button-bar-container {
            padding: 6px 12px;
        }

        :host.platform-windows .button-bar-container {
            padding: 4px 8px;
        }

        :host.platform-linux .button-bar-container {
            padding: 6px 6px;
        }

        .button-bar-main {
            width: 100%;
            max-width: 100%;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .list-selector {
            position: relative;
        }

        .list-toggle {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 10px;
            border-radius: 4px;
            border: 1px solid transparent;
            background: var(--bs-body-bg, #1f1f1f);
            color: var(--bs-body-color, #e0e0e0);
            cursor: pointer;
            font-size: 12px;
        }

        .list-toggle:hover {
            border-color: var(--bs-border-color, #555);
        }

        .list-menu {
            position: absolute;
            bottom: 110%;
            top: auto;
            left: 0;
            min-width: 240px;
            background: var(--bs-body-bg, #1d1d1d);
            border: 1px solid var(--bs-border-color, #444);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            padding: 6px;
            z-index: 10001;
            display: flex;
            flex-direction: column;
            gap: 4px;
            overflow-y: auto;
            max-height: 300px;
            box-sizing: border-box;
        }

        .list-menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 6px;
            font-size: 11px;
            font-weight: 600;
            color: var(--bs-secondary-color, #888);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid var(--bs-border-color, #444);
            margin-bottom: 4px;
        }

        .list-menu-header .btn-sm {
            font-size: 16px;
            padding: 0 4px;
            line-height: 1;
        }

        .list-menu-footer {
            border-top: 1px solid var(--bs-border-color, #444);
            margin-top: 4px;
            padding-top: 6px;
        }

        .list-menu-footer .btn-sm {
            font-size: 11px;
            color: var(--bs-secondary-color, #888);
        }

        .list-menu-footer .btn-sm:hover {
            color: var(--bs-body-color, #e0e0e0);
        }

        .list-menu-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 6px;
            border-radius: 4px;
            background: transparent;
        }

        .list-menu-item.active {
            background: rgba(255, 255, 255, 0.08);
        }

        .list-item-name {
            background: none;
            border: none;
            padding: 0;
            color: var(--bs-body-color, #e0e0e0);
            font-size: 13px;
            cursor: pointer;
            text-align: left;
            flex: 1;
        }

        .list-item-name:hover {
            color: var(--bs-primary, #0d6efd);
        }

        .list-item-actions {
            display: flex;
            gap: 2px;
        }

        .list-item-actions button {
            border: none;
            background: none;
            color: var(--bs-secondary-color, #888);
            cursor: pointer;
            padding: 2px 4px;
            font-size: 12px;
        }

        .list-item-actions button:hover:not(:disabled) {
            color: var(--bs-body-color, #e0e0e0);
        }

        .list-item-actions button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .button-bar-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            flex: 1;
            justify-content: flex-start;
        }

        .cmd-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 10px;
            font-size: 11px;
            font-weight: 500;
            color: var(--bs-body-color, #e0e0e0);
            background: var(--btn-color, #4a4a4a);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
            white-space: nowrap;
            height: 26px;
        }

        .cmd-btn i {
            font-size: 10px;
        }

        .cmd-btn:hover {
            filter: brightness(1.15);
            border-color: rgba(255,255,255,0.2);
        }

        .cmd-btn-add {
            background: transparent;
            border: 1px dashed var(--bs-border-color, #555);
            color: var(--bs-secondary-color, #888);
            padding: 2px 6px;
        }

        .cmd-btn-add:hover {
            border-style: solid;
            color: var(--bs-body-color, #e0e0e0);
        }

        .button-bar-actions {
            display: flex;
        }

        .action-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            padding: 0;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            color: var(--bs-secondary-color, #888);
            cursor: pointer;
        }

        .action-btn:hover {
            border-color: var(--bs-border-color, #555);
            color: var(--bs-body-color, #e0e0e0);
            background: rgba(255,255,255,0.05);
        }

        .modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
        }

        .command-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--bs-body-bg);
            border: 1px solid var(--bs-border-color);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10001;
            width: min(420px, 90vw);
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--bs-border-color);
        }

        .modal-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .form-label {
            font-size: 12px;
            font-weight: 500;
            margin-bottom: 4px;
        }

        .form-control {
            font-size: 13px;
        }

        .color-picker {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        .color-option {
            width: 20px;
            height: 20px;
            border-radius: 3px;
            border: 2px solid transparent;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .color-option:hover {
            transform: scale(1.1);
        }

        .color-option.selected {
            border-color: white;
            box-shadow: 0 0 0 2px var(--bs-primary);
        }

        .color-input {
            width: 28px;
            height: 20px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }

        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 12px 16px;
            border-top: 1px solid var(--bs-border-color);
        }

        .context-menu {
            position: fixed;
            background: var(--bs-body-bg);
            border: 1px solid var(--bs-border-color);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10002;
            min-width: 140px;
            padding: 4px 0;
            font-size: 12px;
        }

        .context-menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            cursor: pointer;
            transition: background 0.2s ease;
            color: var(--bs-body-color);
        }

        .context-menu-item:hover {
            background: var(--bs-tertiary-bg);
        }

        .context-menu-item-danger {
            color: var(--bs-danger);
        }

        .context-menu-item-danger:hover {
            background: var(--bs-danger);
            color: white;
        }

        .context-menu-divider {
            height: 1px;
            background: var(--bs-border-color);
            margin: 4px 0;
        }

        @media (max-width: 768px) {
            .button-bar-main {
                flex-wrap: wrap;
            }

            .button-bar-buttons {
                justify-content: center;
            }

            .list-menu {
                min-width: 200px;
            }
        }
    `]
})
export class ButtonBarComponent extends BaseComponent implements OnInit, OnDestroy {
    @HostBinding('class.button-bar') hostClass = true
    @HostBinding('class.platform-mac') get hostClassMac() { return this.hostApp.platform === Platform.macOS }
    @HostBinding('class.platform-windows') get hostClassWindows() { return this.hostApp.platform === Platform.Windows }
    @HostBinding('class.platform-linux') get hostClassLinux() { return this.hostApp.platform === Platform.Linux }

    lists: ButtonList[] = []
    activeListId = ''
    isMacOS = false

    // Modal state
    modalVisible = false
    modalData: Partial<ButtonCommand> & { sendEnter?: boolean } = {}
    editingButton: ButtonCommand | null = null

    // Context menu state
    contextMenuVisible = false
    contextMenuPosition = { x: 0, y: 0 }
    contextMenuButton: ButtonCommand | null = null

    // List menu state
    listMenuVisible = false
    listMenuStyles: Record<string, string> = {}

    // Import/Export modal
    importExportModalVisible = false
    listsJson = ''

    // List name modal (create/rename)
    listNameModalVisible = false
    listNameInput = ''
    editingList: ButtonList | null = null

    // Delete confirmation modal
    deleteConfirmVisible = false
    listToDelete: ButtonList | null = null

    @ViewChild('listToggleButton', { read: ElementRef }) private listToggleButton?: ElementRef<HTMLElement>
    @ViewChild('listMenu', { read: ElementRef }) private listMenuElement?: ElementRef<HTMLElement>

    get activeList(): ButtonList | undefined {
        return this.lists.find(l => l.id === this.activeListId) || this.lists[0]
    }

    presetColors = [
        '#4a4a4a',
        '#0d6efd',
        '#198754',
        '#dc3545',
        '#ffc107',
        '#0dcaf0',
        '#6f42c1',
        '#fd7e14',
    ]

    private destroy$ = new Subject<void>()
    private lastTerminalTab: BaseTerminalTabComponent<any> | null = null
    private skipNextConfigReload = false
    private storagePath?: string | null
    public barService: any = null

    constructor(
        private app: AppService,
        private config: ConfigService,
        private hostApp: HostAppService,
        private platformService: PlatformService,
    ) {
        super()
        this.isMacOS = this.hostApp.platform === Platform.macOS
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(_event: MouseEvent): void {
        this.contextMenuVisible = false
        this.closeListMenu()
    }

    ngOnInit(): void {
        this.loadLists()

        this.config.changed$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                if (this.skipNextConfigReload) {
                    this.skipNextConfigReload = false
                    return
                }
                this.loadLists()
            })

        const activeTerminal = this.findTerminalTab(this.app.activeTab)
        if (activeTerminal) {
            this.lastTerminalTab = activeTerminal
        }

        // Track terminal tab changes
        this.app.activeTabChange$
            .pipe(takeUntil(this.destroy$))
            .subscribe(tab => {
                const terminal = this.findTerminalTab(tab)
                if (terminal) {
                    this.lastTerminalTab = terminal
                }
            })
    }

    ngOnDestroy(): void {
        this.destroy$.next()
        this.destroy$.complete()
    }

    loadLists(): void {
        const storage = this.loadStorageLists()
        if (storage?.lists?.length) {
            this.lists = storage.lists
            this.activeListId = storage.activeListId || this.lists[0].id
            return
        }

        const pluginConfig = this.config.store.pluginConfig?.['button-bar'] || {}

        // Migration from old format (profiles with groups)
        if (pluginConfig.profiles?.length) {
            const oldProfiles = pluginConfig.profiles
            // Convert old profiles.groups to new lists format
            // Each old "group" becomes a new "list"
            const migratedLists: ButtonList[] = []
            for (const profile of oldProfiles) {
                if (profile.groups?.length) {
                    for (const group of profile.groups) {
                        migratedLists.push({
                            id: group.id || this.generateId(),
                            name: group.name || 'List',
                            buttons: group.buttons || [],
                        })
                    }
                }
            }
            if (migratedLists.length) {
                this.lists = migratedLists
                this.activeListId = pluginConfig.activeGroupId || this.lists[0].id
                this.saveLists()
                return
            }
        }

        // New format
        if (pluginConfig.lists?.length) {
            this.lists = pluginConfig.lists
            this.activeListId = pluginConfig.activeListId || this.lists[0].id
        } else {
            // Default
            this.lists = [this.createDefaultList()]
            this.activeListId = this.lists[0].id
            this.saveLists()
        }
    }

    private getStoragePath(): string | null {
        if (this.storagePath !== undefined) {
            return this.storagePath
        }
        const configPath = this.platformService.getConfigPath()
        if (!configPath) {
            this.storagePath = null
            return null
        }
        this.storagePath = path.join(path.dirname(configPath), 'button-bar-lists.json')
        return this.storagePath
    }

    private loadStorageLists(): ButtonBarStorage | null {
        const storagePath = this.getStoragePath()
        if (!storagePath) {
            return null
        }
        try {
            if (!existsSync(storagePath)) {
                return null
            }
            const content = readFileSync(storagePath, 'utf8')
            return JSON.parse(content) as ButtonBarStorage
        } catch (error) {
            console.warn('ButtonBar: Unable to read storage file', error)
            return null
        }
    }

    saveLists(): void {
        const pluginConfig = this.config.store.pluginConfig || {}
        this.config.store.pluginConfig = pluginConfig
        pluginConfig['button-bar'] = {
            ...(pluginConfig['button-bar'] || {}),
            lists: this.lists,
            activeListId: this.activeListId,
        }
        this.skipNextConfigReload = true
        this.saveStorageLists()
        this.config.save()
    }

    private saveStorageLists(): void {
        const storagePath = this.getStoragePath()
        if (!storagePath) {
            return
        }
        try {
            mkdirSync(path.dirname(storagePath), { recursive: true })
            writeFileSync(storagePath, JSON.stringify({
                lists: this.lists,
                activeListId: this.activeListId,
            }, null, 2), 'utf8')
        } catch (error) {
            console.warn('ButtonBar: Unable to persist lists', error)
        }
    }

    private createDefaultList(): ButtonList {
        return {
            id: this.generateId(),
            name: 'List 1',
            buttons: [],
        }
    }

    private generateId(): string {
        return 'btn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
    }

    toggleCollapse(): void {
        if (this.barService) {
            this.barService.hide()
        }
    }

    private findTerminalTab(tab: BaseTabComponent | null): BaseTerminalTabComponent<any> | null {
        if (!tab) {
            return null
        }
        if (tab instanceof BaseTerminalTabComponent) {
            return tab
        }
        if (tab instanceof SplitTabComponent) {
            const focused = tab.getFocusedTab()
            const focusedTerminal = this.findTerminalTab(focused)
            if (focusedTerminal) {
                return focusedTerminal
            }

            for (const child of tab.getAllTabs()) {
                const candidate = this.findTerminalTab(child)
                if (candidate) {
                    return candidate
                }
            }
        }
        return null
    }

    private getFirstTerminalFromTabs(): BaseTerminalTabComponent<any> | null {
        const tabs = this.app.tabs || []
        for (const tab of tabs) {
            const candidate = this.findTerminalTab(tab)
            if (candidate) {
                return candidate
            }
        }
        return null
    }

    private getActiveTerminalTab(): BaseTerminalTabComponent<any> | null {
        const fromActive = this.findTerminalTab(this.app.activeTab)
        if (fromActive) {
            return fromActive
        }
        if (this.lastTerminalTab) {
            return this.lastTerminalTab
        }
        const fromTabs = this.getFirstTerminalFromTabs()
        if (fromTabs) {
            this.lastTerminalTab = fromTabs
            return fromTabs
        }
        return null
    }

    // Terminal command execution
    executeCommand(btn: ButtonCommand, event?: MouseEvent): void {
        event?.preventDefault()
        event?.stopPropagation()
        const terminal = this.getActiveTerminalTab()
        const terminalAny = terminal as BaseTerminalTabComponent<any> & { inputProcessor?: { writeText?: (text: string) => void } }

        if (!terminal) {
            console.warn('ButtonBar: No terminal tab found')
            return
        }

        const focusTerminal = () => terminalAny.frontend?.focus()

        setTimeout(() => {
            focusTerminal()
            const sanitizedCommand = btn.command.replace(/\r?\n/g, ' ')
            if (terminalAny.inputProcessor?.writeText) {
                terminalAny.inputProcessor.writeText(sanitizedCommand)
                if (btn.sendEnter === true) {
                    terminalAny.sendInput('\n')
                }
            } else if (terminalAny.sendInput) {
                let command = sanitizedCommand
                if (btn.sendEnter === true) {
                    command += '\n'
                }
                terminalAny.sendInput(command)
            }
            setTimeout(focusTerminal, 20)
        }, 10)
    }

    // List menu
    toggleListMenu(event: MouseEvent): void {
        event.stopPropagation()
        this.listMenuVisible = !this.listMenuVisible
        if (this.listMenuVisible) {
            requestAnimationFrame(() => this.positionListMenu())
        }
    }

    closeListMenu(): void {
        this.listMenuVisible = false
        this.listMenuStyles = {}
    }

    private positionListMenu(): void {
        if (!this.listToggleButton || !this.listMenuElement) {
            return
        }

        const toggleRect = this.listToggleButton.nativeElement.getBoundingClientRect()
        const menuEl = this.listMenuElement.nativeElement
        const menuHeight = menuEl.offsetHeight
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight
        const margin = 8

        const availableAbove = toggleRect.top - margin
        const availableBelow = viewportHeight - toggleRect.bottom - margin
        const preferAbove = availableAbove >= menuHeight && availableAbove >= availableBelow

        const styles: Record<string, string> = {}

        if (preferAbove) {
            styles.bottom = `${toggleRect.height + margin}px`
            styles.top = 'auto'
            styles.maxHeight = `${Math.max(availableAbove, 120)}px`
        } else {
            styles.top = `${toggleRect.height + margin}px`
            styles.bottom = 'auto'
            styles.maxHeight = `${Math.max(availableBelow, 120)}px`
        }

        const menuWidth = menuEl.offsetWidth
        const overflowRight = toggleRect.left + menuWidth - window.innerWidth + 12
        styles.left = overflowRight > 0 ? `${Math.max(-overflowRight, -toggleRect.left)}px` : '0px'

        this.listMenuStyles = styles
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        if (this.listMenuVisible) {
            this.positionListMenu()
        }
    }

    // List operations
    setActiveList(id: string): void {
        if (this.activeListId === id) {
            this.closeListMenu()
            return
        }
        this.activeListId = id
        this.saveLists()
        this.closeListMenu()
    }

    createList(event?: MouseEvent): void {
        event?.stopPropagation()
        event?.preventDefault()
        this.closeListMenu()
        this.editingList = null
        this.listNameInput = `List ${this.lists.length + 1}`
        this.listNameModalVisible = true
    }

    renameList(event: MouseEvent, list: ButtonList): void {
        event.stopPropagation()
        event.preventDefault()
        this.closeListMenu()
        this.editingList = list
        this.listNameInput = list.name
        this.listNameModalVisible = true
    }

    duplicateList(event: MouseEvent, list: ButtonList): void {
        event.stopPropagation()
        event.preventDefault()
        this.closeListMenu()
        const copy: ButtonList = {
            id: this.generateId(),
            name: `${list.name} (copy)`,
            buttons: list.buttons.map(btn => ({ ...btn, id: this.generateId() })),
        }
        this.lists.push(copy)
        this.activeListId = copy.id
        this.saveLists()
    }

    deleteList(event: MouseEvent, list: ButtonList): void {
        event.stopPropagation()
        event.preventDefault()
        if (this.lists.length === 1) return
        this.closeListMenu()
        this.listToDelete = list
        this.deleteConfirmVisible = true
    }

    // List name modal methods
    closeListNameModal(): void {
        this.listNameModalVisible = false
        this.editingList = null
        this.listNameInput = ''
    }

    saveListName(): void {
        const name = this.listNameInput?.trim()
        if (!name) return

        if (this.editingList) {
            // Rename existing list
            this.editingList.name = name
        } else {
            // Create new list
            const list: ButtonList = {
                id: this.generateId(),
                name,
                buttons: [],
            }
            this.lists.push(list)
            this.activeListId = list.id
        }

        this.saveLists()
        this.closeListNameModal()
    }

    // Delete confirmation modal methods
    closeDeleteConfirm(): void {
        this.deleteConfirmVisible = false
        this.listToDelete = null
    }

    confirmDeleteList(): void {
        if (!this.listToDelete) return
        const listId = this.listToDelete.id
        this.lists = this.lists.filter(l => l.id !== listId)
        if (this.activeListId === listId) {
            this.activeListId = this.lists[0]?.id || ''
        }
        this.saveLists()
        this.closeDeleteConfirm()
    }

    // Command modal
    openAddModal(): void {
        this.editingButton = null
        this.modalData = {
            label: '',
            command: '',
            icon: '',
            color: this.presetColors[0],
            tooltip: '',
            sendEnter: false,
        }
        this.modalVisible = true
    }

    openEditModal(btn: ButtonCommand): void {
        this.editingButton = btn
        this.modalData = { ...btn }
        this.modalVisible = true
    }

    closeModal(): void {
        this.modalVisible = false
        this.editingButton = null
        this.modalData = {}
    }

    saveButton(): void {
        if (!this.modalData.label || !this.modalData.command) return

        const list = this.activeList
        if (!list) return

        if (this.editingButton) {
            Object.assign(this.editingButton, {
                label: this.modalData.label,
                command: this.modalData.command?.replace(/\r?\n/g, ' '),
                icon: this.modalData.icon || undefined,
                color: this.modalData.color || undefined,
                tooltip: this.modalData.tooltip || undefined,
                sendEnter: this.modalData.sendEnter,
            })
        } else {
            const commandText = this.modalData.command!.replace(/\\r?\\n/g, ' ')
            const newButton: ButtonCommand = {
                id: this.generateId(),
                label: this.modalData.label!,
                command: commandText,
                icon: this.modalData.icon || undefined,
                color: this.modalData.color || undefined,
                tooltip: this.modalData.tooltip || undefined,
                sendEnter: this.modalData.sendEnter,
            }
            list.buttons.push(newButton)
        }

        this.saveLists()
        this.closeModal()
    }

    // Context menu
    onButtonContextMenu(event: MouseEvent, btn: ButtonCommand): void {
        event.preventDefault()
        event.stopPropagation()
        this.contextMenuButton = btn
        this.contextMenuPosition = { x: event.clientX, y: event.clientY }
        this.contextMenuVisible = true
    }

    contextMenuEdit(): void {
        if (this.contextMenuButton) {
            this.openEditModal(this.contextMenuButton)
        }
        this.contextMenuVisible = false
    }

    contextMenuDuplicate(): void {
        if (this.contextMenuButton && this.activeList) {
            const newButton: ButtonCommand = {
                ...this.contextMenuButton,
                id: this.generateId(),
                label: this.contextMenuButton.label + ' (copy)',
            }
            this.activeList.buttons.push(newButton)
            this.saveLists()
        }
        this.contextMenuVisible = false
    }

    contextMenuDelete(): void {
        if (this.contextMenuButton && this.activeList) {
            const index = this.activeList.buttons.indexOf(this.contextMenuButton)
            if (index !== -1) {
                this.activeList.buttons.splice(index, 1)
                this.saveLists()
            }
        }
        this.contextMenuVisible = false
    }

    // Import/Export
    openImportExportModal(event?: MouseEvent): void {
        event?.stopPropagation()
        event?.preventDefault()
        this.listsJson = JSON.stringify({ lists: this.lists, activeListId: this.activeListId }, null, 2)
        this.importExportModalVisible = true
        this.closeListMenu()
    }

    closeImportExportModal(): void {
        this.importExportModalVisible = false
    }

    exportLists(): void {
        this.listsJson = JSON.stringify({ lists: this.lists, activeListId: this.activeListId }, null, 2)
    }

    importLists(): void {
        if (!this.listsJson) return
        try {
            const parsed = JSON.parse(this.listsJson)
            const rawLists = Array.isArray(parsed) ? parsed : parsed.lists
            if (!Array.isArray(rawLists) || !rawLists.length) {
                throw new Error('No lists found')
            }
            this.lists = rawLists.map((list: any) => ({
                id: list.id || this.generateId(),
                name: list.name || 'List',
                buttons: (list.buttons || []).map((btn: any) => ({
                    ...btn,
                    id: btn.id || this.generateId(),
                })),
            }))
            const candidateId = typeof parsed.activeListId === 'string' ? parsed.activeListId : ''
            if (candidateId && this.lists.some(l => l.id === candidateId)) {
                this.activeListId = candidateId
            } else {
                this.activeListId = this.lists[0].id
            }
            this.saveLists()
            this.closeImportExportModal()
        } catch (err) {
            console.warn('ButtonBarComponent: Unable to parse lists JSON', err)
        }
    }
}
