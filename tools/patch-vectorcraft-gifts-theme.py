#!/usr/bin/env python3
"""Opt-in gifts.ru visual skin for the pinned Rust/egui VectorCraft UI.

This is applied ONLY to Maketnaya's embedded VectorCraft build and activated
per-session by a verified bridge message. Native VectorCraft colors and state
remain available and are restored verbatim after switching back.
"""
from pathlib import Path
import sys
root=Path(sys.argv[1]).resolve()

def patch(relative, modifications):
    file=root/relative
    source=file.read_text()
    for before,after in modifications:
        count=source.count(before)
        if count!=1:
            raise RuntimeError(f'VectorCraft upstream changed {relative}: {before[:90]!r} present {count} times')
        source=source.replace(before,after)
    file.write_text(source)
    print('Installed gifts.ru skin in',relative)

fn= r'''
/// Maketnaya skin: gifts.ru-inspired clean panels and green active controls.
/// All tools, commands, editing logic and artwork rendering remain native.
/// The caller snapshots and restores the exact original egui style/tokens.
pub fn apply_gifts(ctx: &egui::Context) {
    let c = |n: u32| Color32::from_rgb((n >> 16) as u8, (n >> 8) as u8, n as u8);
    let mut t=Tokens::for_scheme(Scheme::Modern, Brightness::Light, Accent::Green);
    t.dark=false;
    t.app_bar=c(0xf6f9f3);
    t.panel=c(0xffffff);
    t.panel_darker=c(0xf0f5ed);
    t.input=c(0xf8fbf6);
    t.input_border=c(0xcbdcc0);
    t.border=c(0xdbe6d5);
    t.divider=c(0xe6ede1);
    t.text=c(0x243126);
    t.text_strong=c(0x1a291c);
    t.text_dim=c(0x627465);
    t.text_disabled=c(0x9baaa0);
    t.icon=c(0x405d42);
    t.hover=c(0xeaf4dc);
    t.tool_active=c(0xd6e9bb);
    t.accent=c(0x78aa1e);
    t.accent_strong=c(0x5d9313);
    t.row_selected=c(0xe1efcc);
    t.pasteboard=c(0xe9efe6);
    t.ruler=c(0xf2f7ee);
    t.ruler_tick=c(0x688269);
    t.button=c(0xf2f7eb);
    t.radius=8;
    t.tab_strip=c(0xf1f6eb);
    t.button_border=c(0xcbdcc0);
    t.flyout_active=c(0x517f15);
    t.measure_bg=Color32::from_rgba_unmultiplied(244,250,239,240);
    // Distinct anchors remain visible against green accents and artwork.
    t.selection=c(0x3981db);
    t.anchor_selected=c(0x2671cd);
    ctx.data_mut(|data|data.insert_temp(egui::Id::NULL,t));
    let mut v=Visuals::light();
    v.panel_fill=t.panel;
    v.window_fill=t.panel;
    v.extreme_bg_color=t.input;
    v.faint_bg_color=t.panel_darker;
    v.window_stroke=Stroke::new(1.0,t.border);
    v.window_corner_radius=CornerRadius::same(12);
    v.menu_corner_radius=CornerRadius::same(10);
    v.override_text_color=Some(t.text);
    v.selection.bg_fill=t.accent.gamma_multiply(0.35);
    v.selection.stroke=Stroke::new(1.0,t.accent_strong);
    v.hyperlink_color=t.accent_strong;
    v.popup_shadow=egui::epaint::Shadow {
        offset:[0,3], blur:16, spread:0, color:Color32::from_black_alpha(35)
    };
    v.window_shadow=egui::epaint::Shadow {
        offset:[0,7], blur:24, spread:0, color:Color32::from_black_alpha(48)
    };
    craft_ui::theme::WidgetPalette {
        noninteractive:t.panel, inactive:t.button,
        hovered:t.hover, active:t.tool_active, open:t.hover,
    }.apply_to(&mut v.widgets,t.cr(),Stroke::new(1.0,t.text));
    v.widgets.noninteractive.bg_stroke=Stroke::new(1.0,t.divider);
    v.widgets.inactive.bg_stroke=Stroke::new(1.0,t.button_border);
    v.widgets.hovered.bg_stroke=Stroke::new(1.0,t.accent);
    v.widgets.active.bg_stroke=Stroke::new(1.0,t.accent_strong);
    ctx.set_visuals(v);
    ctx.global_style_mut(|style|{
        style.spacing.item_spacing=egui::vec2(7.0,6.0);
        style.spacing.button_padding=egui::vec2(9.0,4.0);
        style.spacing.interact_size=egui::vec2(26.0,27.0);
        style.spacing.menu_margin=egui::Margin::same(8);
        style.spacing.slider_width=130.0;
        style.animation_time=0.14;
    });
}
'''
patch('crates/ui-egui/src/theme.rs', [
    ('#[cfg(test)]\nmod tests {',fn+'\n#[cfg(test)]\nmod tests {')
])
# The web bridge first adds the Host fields and single-document mode; apply the
# theme after those transforms, so this remains pinned to upstream source.
patch('apps/vectorcraft-web/src/web.rs', [
    ('    bridge_field_mm: Rc<RefCell<Option<(f64,f64,bool)>>>,\n}',
     '    bridge_field_mm: Rc<RefCell<Option<(f64,f64,bool)>>>,\n'
     '    bridge_gifts_style: Rc<Cell<bool>>,\n'
     '    bridge_gifts_pending: Rc<Cell<bool>>,\n'
     '    bridge_native_style: Rc<RefCell<Option<(egui::Style, vectorcraft_ui_egui::theme::Tokens)>>>,\n}'),
    ('            bridge_field_mm: Rc::default(),\n',
     '            bridge_field_mm: Rc::default(),\n'
     '            bridge_gifts_style: Rc::default(),\n'
     '            bridge_gifts_pending: Rc::default(),\n'
     '            bridge_native_style: Rc::default(),\n'),
    ('        app.logic(ctx);\n',
     '''        app.logic(ctx);
        if gwb_is_embedded() && self.host.bridge_gifts_pending.replace(false) {
            let gifts=self.host.bridge_gifts_style.get();
            if gifts {
                // Keep the original precise visuals (including user-selected
                // options), restoring them when switching to native design.
                *self.host.bridge_native_style.borrow_mut()=Some((
                    ctx.style().as_ref().clone(),
                    vectorcraft_ui_egui::theme::Tokens::get(ctx)
                ));
                vectorcraft_ui_egui::theme::apply_gifts(ctx);
            } else if let Some((style,tokens))=self.host.bridge_native_style.borrow_mut().take() {
                ctx.set_style(style);
                ctx.data_mut(|data|data.insert_temp(egui::Id::NULL,tokens));
            }
            ctx.request_repaint();
            gwb_send("gwb-vectorcraft-theme-applied",None,Some(if gifts {"gifts"} else {"native"}));
        }
''')
])
print('Installed live, in-place gifts/native theme selector; no documents reloaded')
