// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Fernando Sahmkow
// MDLxL-specific adapter built against pinned WhiteoutLib source.

#include <emscripten/bind.h>
#include <emscripten/val.h>

#include <algorithm>
#include <cstddef>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include <whiteout/common_types.h>
#include <whiteout/textures/blp/types.h>
#include <whiteout/textures/blp/writer.h>
#include <whiteout/textures/blp/parser.h>
#include <whiteout/textures/dds/writer.h>
#include <whiteout/textures/texture.h>

using namespace emscripten;
using namespace whiteout;

namespace {

std::vector<u8> paintEncodeBlp1(const val& jsArray, u32 width, u32 height,
                                i32 jpegQuality) {
    if (width == 0 || height == 0 || width > 4096 || height > 4096) {
        throw std::runtime_error("paintEncodeBlp1 expects dimensions from 1 to 4096");
    }

    auto bytes = convertJSArrayToNumberVector<u8>(jsArray);
    const auto expected = static_cast<std::size_t>(width) * height * 4;
    if (bytes.size() != expected) {
        throw std::runtime_error("paintEncodeBlp1 expects width*height*4 RGBA bytes");
    }

    auto texture = textures::Texture::create2D(
        textures::PixelFormat::RGBA8, width, height, 1);
    texture.setData(std::move(bytes));

    if (auto error = texture.generateMipmaps(
            textures::computeMaxMipCount(width, height), nullptr)) {
        throw std::runtime_error("paintEncodeBlp1 mipmap generation failed: " + *error);
    }

    textures::blp::SaveOptions options;
    options.version = textures::blp::BlpVersion::BLP1;
    options.encoding = textures::blp::BlpEncoding::JPEG;
    options.alpha = textures::blp::BlpAlphaDepth::Eight;
    options.jpegQuality = std::clamp(jpegQuality, 1, 100);
    options.jpegProgressive = false;

    textures::blp::Writer writer;
    auto result = writer.write(texture, options);
    if (result.empty()) {
        throw std::runtime_error("WhiteoutLib returned an empty BLP1 payload");
    }
    return result;
}

std::vector<u8> paintEncodeDds(const val& jsArray, u32 width, u32 height) {
    if (width == 0 || height == 0 || width > 4096 || height > 4096) {
        throw std::runtime_error("DDS dimensions must be from 1 to 4096");
    }
    auto bytes = convertJSArrayToNumberVector<u8>(jsArray);
    if (bytes.size() != static_cast<std::size_t>(width) * height * 4) {
        throw std::runtime_error("DDS expects width*height*4 RGBA bytes");
    }
    auto texture = textures::Texture::create2D(textures::PixelFormat::RGBA8, width, height, 1);
    texture.setData(std::move(bytes));
    if (auto error = texture.generateMipmaps(textures::computeMaxMipCount(width, height), nullptr)) {
        throw std::runtime_error("DDS mipmap generation failed: " + *error);
    }
    texture.format(textures::PixelFormat::BC3);
    textures::dds::Writer writer;
    auto result = writer.write(texture);
    if (result.empty()) throw std::runtime_error("WhiteoutLib returned an empty DDS payload");
    return result;
}

val paintDecodeBlp(const val& jsArray) {
    auto bytes = convertJSArrayToNumberVector<u8>(jsArray);
    textures::blp::Parser parser;
    auto texture = parser.parse(std::span<const u8>(bytes));
    if (!texture) {std::string message="WhiteoutLib could not decode this BLP texture";for(const auto& issue:parser.getIssues())message += ": " + issue;throw std::runtime_error(message);}
    texture->format(textures::PixelFormat::RGBA8);
    auto pixels = texture->mipData(0);
    auto result = val::object();
    result.set("width", texture->width());
    result.set("height", texture->height());
    result.set("data", val::global("Uint8Array").new_(val(typed_memory_view(pixels.size(), pixels.data()))));
    return result;
}

} // namespace

EMSCRIPTEN_BINDINGS(mdlxl_paint_blp) {
    register_vector<u8>("VectorU8");
    function("paintEncodeBlp1", &paintEncodeBlp1);
    function("paintDecodeBlp", &paintDecodeBlp);
    function("paintEncodeDds", &paintEncodeDds);
}
