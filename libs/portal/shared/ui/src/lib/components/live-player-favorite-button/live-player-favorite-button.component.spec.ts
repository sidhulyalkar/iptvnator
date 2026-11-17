import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { LivePlayerFavoriteButtonComponent } from './live-player-favorite-button.component';

describe('LivePlayerFavoriteButtonComponent', () => {
    let fixture: ComponentFixture<LivePlayerFavoriteButtonComponent>;
    let component: LivePlayerFavoriteButtonComponent;
    let toggles: number;
    let retries: number;

    beforeEach(async () => {
        toggles = 0;
        retries = 0;
        await TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot(), LivePlayerFavoriteButtonComponent],
        }).compileComponents();
        fixture = TestBed.createComponent(LivePlayerFavoriteButtonComponent);
        component = fixture.componentInstance;
        component.toggleRequested.subscribe(() => toggles++);
        component.retryRequested.subscribe(() => retries++);
        fixture.componentRef.setInput('channelName', 'News');
        fixture.componentRef.setInput(
            'sourceName',
            'https://user:secret@panel.example.com/list?password=SECRET'
        );
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    const button = (): HTMLButtonElement =>
        fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    it('renders credential-safe source identity and confirmed pressed state', () => {
        expect(button().getAttribute('aria-label')).toContain('News');
        expect(button().getAttribute('aria-label')).toContain('panel.example.com');
        expect(button().getAttribute('aria-label')).not.toContain('secret');
        expect(button().getAttribute('aria-label')).not.toContain('SECRET');
        expect(button().getAttribute('aria-pressed')).toBe('false');

        button().click();
        expect(toggles).toBe(1);
        expect(button().getAttribute('aria-pressed')).toBe('false');

        fixture.componentRef.setInput('isFavorite', true);
        fixture.detectChanges();
        expect(button().getAttribute('aria-pressed')).toBe('true');
        button().click();
        expect(toggles).toBe(2);
    });

    it('does not toggle while unknown or pending, and routes Retry to read-only refresh', () => {
        fixture.componentRef.setInput('known', false);
        fixture.detectChanges();
        expect(button().disabled).toBe(true);
        expect(button().getAttribute('aria-pressed')).toBeNull();
        component.activate();
        expect(toggles).toBe(0);

        fixture.componentRef.setInput('retryable', true);
        fixture.detectChanges();
        expect(button().disabled).toBe(false);
        expect(button().getAttribute('aria-pressed')).toBeNull();
        expect(button().querySelector('mat-icon')?.textContent).toContain(
            'refresh'
        );
        button().click();
        expect(retries).toBe(1);
        expect(toggles).toBe(0);

        fixture.componentRef.setInput('pending', true);
        fixture.detectChanges();
        expect(button().disabled).toBe(true);
        component.activate();
        expect(retries).toBe(1);
        expect(toggles).toBe(0);
    });
});
