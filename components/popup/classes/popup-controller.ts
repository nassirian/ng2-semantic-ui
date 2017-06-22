import {
    ComponentRef, ElementRef, ViewContainerRef, ComponentFactoryResolver,
    HostListener, EventEmitter, Type, OnDestroy
} from "@angular/core";
import { PopupConfig, PopupTrigger } from "./popup-config";
import { SuiPopup } from "../components/popup";
import { SuiPopupConfig } from "../services/popup.service";
import { SuiComponentFactory } from "../../util/services/component-factory.service";
import { IPopupLifecycle } from "./popup-lifecycle";

export interface IPopup {
    open():void;
    close():void;
    toggle():void;
}

export abstract class SuiPopupController implements IPopup, OnDestroy, IPopupLifecycle {
    // Stores reference to generated popup component.
    private _componentRef:ComponentRef<SuiPopup>;

    // Returns generated popup instance.
    public get popup():SuiPopup {
        // Use non-null assertion as we only access this when a popup exists.
        return this._componentRef.instance;
    }

    // `setTimeout` timer pointer for delayed popup open.
    private _openingTimeout:number;

    constructor(protected _element:ElementRef,
                protected _componentFactory:SuiComponentFactory,
                config:PopupConfig) {

        // Generate a new SuiPopup component and attach it to the application view.
        this._componentRef = this._componentFactory.createComponent(SuiPopup);
        this._componentFactory.attachToApplication(this._componentRef);
        this._componentFactory.detachFromDocument(this._componentRef);

        // Configure popup with provided config, and attach a reference to the anchor element.
        this.popup.config = config;
        this.popup.anchor = this._element;

        // When the popup is closed (onClose fires on animation complete),
        this.popup.onClose.subscribe(() =>
            this._componentFactory.detachFromDocument(this._componentRef));
    }

    public openDelayed():void {
        // Cancel the opening timer.
        clearTimeout(this._openingTimeout);

        // Start the popup opening after the specified delay interval.
        this._openingTimeout = window.setTimeout(() => this.open(), this.popup.config.delay);
    }

    public open():void {
        // If there is a template, inject it into the view.
        if (this.popup.config.template) {
            this.popup.templateSibling.clear();

            this._componentFactory.createView(this.popup.templateSibling, this.popup.config.template, {
                $implicit: this.popup
            });
        }

        // Move the generated element to the body to avoid any positioning issues.
        this._componentFactory.moveToDocumentBody(this._componentRef);

        // Start popup open transition.
        this.popup.open();

        // Call lifecyle hook
        const lifecycle = (this as IPopupLifecycle).popupOnOpen;
        if (lifecycle) {
            lifecycle.call(this);
        }
    }

    public close():void {
        // Cancel the opening timer to stop the popup opening after close has been called.
        clearTimeout(this._openingTimeout);

        if (this._componentRef) {
            // Start popup close transition.
            this.popup.close();
        }

        // Call lifecyle hook
        const lifecycle = (this as IPopupLifecycle).popupOnClose;
        if (lifecycle) {
            lifecycle.call(this);
        }
    }

    public toggleDelayed():void {
        // If the popup hasn't been created, or it has but it isn't currently open, open the popup.
        if (!this._componentRef || (this._componentRef && !this.popup.isOpen)) {
            return this.openDelayed();
        }

        // O'wise, close it.
        return this.close();
    }

    public toggle():void {
        // If the popup hasn't been created, or it has but it isn't currently open, open the popup.
        if (!this._componentRef || (this._componentRef && !this.popup.isOpen)) {
            return this.open();
        }

        // O'wise, close it.
        return this.close();
    }

    @HostListener("mouseenter")
    private onMouseEnter():void {
        if (this.popup.config.trigger === PopupTrigger.Hover) {
            this.openDelayed();
        }
    }

    @HostListener("mouseleave")
    private onMouseLeave():void {
        if (this.popup.config.trigger === PopupTrigger.Hover) {
            this.close();
        }
    }

    @HostListener("click")
    private onClick():void {
        if (this.popup.config.trigger === PopupTrigger.Click ||
            this.popup.config.trigger === PopupTrigger.OutsideClick) {

            // Repeated clicks require a toggle, rather than just opening the popup each time.
            this.toggleDelayed();
        } else if (this.popup.config.trigger === PopupTrigger.Focus &&
                   (!this._componentRef || (this._componentRef && !this.popup.isOpen))) {
            // Repeated clicks with a focus trigger requires an open (as focus isn't ever lost on repeated click).
            this.openDelayed();
        }
    }

    @HostListener("document:click", ["$event"])
    public onDocumentClick(e:MouseEvent):void {
        // If the popup trigger is outside click,
        if (this._componentRef && this.popup.config.trigger === PopupTrigger.OutsideClick) {
            const target = e.target as Element;
            // Close the popup if the click is outside of the popup element.
            if (!(this._element.nativeElement as Element).contains(target)) {
                this.close();
            }
        }
    }

    @HostListener("focus")
    private onFocus():void {
        if (this.popup.config.trigger === PopupTrigger.Focus) {
            this.openDelayed();
        }
    }

    @HostListener("focusout")
    private onFocusOut():void {
        if (this.popup.config.trigger === PopupTrigger.Focus) {
            this.close();
        }
    }

    public ngOnDestroy():void {
        this._componentRef.destroy();
    }
}
